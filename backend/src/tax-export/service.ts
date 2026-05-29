/**
 * Tax Export Service
 * Generates tax invoice export data from checkout-date reservations.
 * Follows the Vietnamese tax invoice template format.
 */
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";
import path from "path";
import fs from "fs";

const TEMPLATE_PATH = path.join(__dirname, "../../fixtures/Tax_export_template.xlsx");
const VIETNAM_TZ = "Asia/Ho_Chi_Minh";

function getVietnamToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function toDateOnly(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function toDateKey(input: Date | string) {
  return new Date(input).toISOString().slice(0, 10);
}

function formatVietnameseDate(dateKey: string) {
  const parts = dateKey.split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function daysBetween(start: string, end: string) {
  const s = toDateOnly(start).getTime();
  const e = toDateOnly(end).getTime();
  return Math.max(Math.round((e - s) / 86400000), 1);
}

export interface TaxExportSettings {
  default_buyer_label: string;
  default_payment_method: string;
  default_unit: string;
  default_vat_rate: number;
  service_name_template: string;
}

export interface TaxExportItemPreview {
  invoice_number: string;
  invoice_date: string;
  buyer_label: string;
  payment_method: string;
  service_description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  vat_rate: number;
  vat_amount: number;
  guest_name: string;
  property_name: string;
  check_in_date: string;
  check_out_date: string;
  reservation_id: string;
  confirmation_code: string | null;
  status: string;
  needs_review_reason: string | null;
}

const DEFAULT_SETTINGS: TaxExportSettings = {
  default_buyer_label: "Khách lẻ không lấy hóa đơn",
  default_payment_method: "Chuyển khoản",
  default_unit: "Đêm",
  default_vat_rate: 8,
  service_name_template: "Dịch vụ thuê phòng ({check_in} - {check_out})",
};

export async function getOrCreateSettings(prisma: PrismaClient): Promise<TaxExportSettings> {
  const existing = await prisma.tax_export_settings.findFirst();
  if (existing) {
    return {
      default_buyer_label: existing.default_buyer_label,
      default_payment_method: existing.default_payment_method,
      default_unit: existing.default_unit,
      default_vat_rate: existing.default_vat_rate,
      service_name_template: existing.service_name_template,
    };
  }
  const created = await prisma.tax_export_settings.create({ data: {} });
  return {
    default_buyer_label: created.default_buyer_label,
    default_payment_method: created.default_payment_method,
    default_unit: created.default_unit,
    default_vat_rate: created.default_vat_rate,
    service_name_template: created.service_name_template,
  };
}

export async function previewTaxExport(
  prisma: PrismaClient,
  checkoutDate?: string,
  propertyId?: string
): Promise<{ items: TaxExportItemPreview[]; checkoutDate: string }> {
  const dateKey = checkoutDate || getVietnamToday();
  const settings = await getOrCreateSettings(prisma);

  const where: any = {
    check_out_date: toDateOnly(dateKey),
    status: { notIn: ["cancelled", "no_show"] },
  };
  if (propertyId) where.property_id = propertyId;

  const reservations = await prisma.reservations.findMany({
    where,
    include: {
      property: { select: { name: true } },
      reservation_external_refs: { select: { confirmation_code: true } },
    },
    orderBy: { check_in_date: "asc" },
  });

  // Get the last used invoice number
  const lastItem = await prisma.tax_export_items.findFirst({
    orderBy: { invoice_number: "desc" },
    select: { invoice_number: true },
  });
  let nextInvoiceNum = lastItem ? parseInt(lastItem.invoice_number, 10) + 1 : 1;

  const items: TaxExportItemPreview[] = reservations.map((res) => {
    const checkIn = toDateKey(res.check_in_date);
    const checkOut = toDateKey(res.check_out_date);
    const nights = daysBetween(checkIn, checkOut);
    const confirmationCode = res.reservation_external_refs?.[0]?.confirmation_code ?? null;

    // Estimate unit price from operational notes or use a default
    const priceMatch = res.operational_notes.match(/nightly_rate=(\d+)/);
    const unitPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
    const totalAmount = unitPrice * nights;
    const vatAmount = Math.round(totalAmount * settings.default_vat_rate / 100);

    const serviceDesc = settings.service_name_template
      .replace("{check_in}", formatVietnameseDate(checkIn))
      .replace("{check_out}", formatVietnameseDate(checkOut));

    let status = "exported";
    let needsReviewReason: string | null = null;
    if (unitPrice === 0) {
      status = "needs_review";
      needsReviewReason = "Unit price not found in reservation data";
    }

    return {
      invoice_number: String(nextInvoiceNum++),
      invoice_date: formatVietnameseDate(dateKey),
      buyer_label: settings.default_buyer_label,
      payment_method: settings.default_payment_method,
      service_description: serviceDesc,
      unit: settings.default_unit,
      quantity: nights,
      unit_price: unitPrice,
      total_amount: totalAmount,
      vat_rate: settings.default_vat_rate,
      vat_amount: vatAmount,
      guest_name: res.guest_name,
      property_name: (res as any).property?.name ?? "",
      check_in_date: checkIn,
      check_out_date: checkOut,
      reservation_id: res.id,
      confirmation_code: confirmationCode,
      status,
      needs_review_reason: needsReviewReason,
    };
  });

  return { items, checkoutDate: dateKey };
}

export async function runTaxExport(
  prisma: PrismaClient,
  checkoutDate?: string,
  propertyId?: string
): Promise<{ jobId: string; items: TaxExportItemPreview[]; checkoutDate: string }> {
  const preview = await previewTaxExport(prisma, checkoutDate, propertyId);

  const job = await prisma.tax_export_jobs.create({
    data: {
      checkout_date: toDateOnly(preview.checkoutDate),
      status: "completed",
      total_items: preview.items.length,
      exported_count: preview.items.filter((i) => i.status === "exported").length,
      failed_count: 0,
      skipped_count: 0,
      review_count: preview.items.filter((i) => i.status === "needs_review").length,
      triggered_by: "manual",
      completed_at: new Date(),
    },
  });

  for (const item of preview.items) {
    await prisma.tax_export_items.create({
      data: {
        job_id: job.id,
        reservation_id: item.reservation_id,
        invoice_number: item.invoice_number,
        invoice_date: item.invoice_date,
        buyer_label: item.buyer_label,
        payment_method: item.payment_method,
        service_description: item.service_description,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_amount: item.total_amount,
        vat_rate: item.vat_rate,
        vat_amount: item.vat_amount,
        status: item.status,
        needs_review_reason: item.needs_review_reason,
        guest_name: item.guest_name,
        property_name: item.property_name,
        check_in_date: item.check_in_date,
        check_out_date: item.check_out_date,
        confirmation_code: item.confirmation_code,
      },
    });
  }

  return { jobId: job.id, items: preview.items, checkoutDate: preview.checkoutDate };
}

export async function generateExcelBuffer(
  items: TaxExportItemPreview[]
): Promise<Buffer> {
  // Try to load template
  let wb: XLSX.WorkBook;
  if (fs.existsSync(TEMPLATE_PATH)) {
    wb = XLSX.readFile(TEMPLATE_PATH);
  } else {
    wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, "Final Correct");
  }

  const ws = wb.Sheets[wb.SheetNames[0]];

  // Rows 1-7 are template header/instructions, Row 8 is column headers
  // Data starts at row 9 (0-indexed: row 8)
  const DATA_START_ROW = 8; // 0-indexed

  items.forEach((item, idx) => {
    const row = DATA_START_ROW + idx;
    const setCell = (col: string, value: string | number) => {
      ws[`${col}${row + 1}`] = { v: value, t: typeof value === "number" ? "n" : "s" };
    };

    setCell("A", item.invoice_number);
    setCell("B", item.invoice_date);
    // C, D, E left empty per user requirement
    setCell("F", item.buyer_label);
    // G, H, I left empty per user requirement
    setCell("J", item.payment_method);
    setCell("K", item.service_description);
    setCell("L", item.unit);
    setCell("M", item.quantity);
    setCell("N", item.unit_price);
    setCell("O", item.total_amount);
    setCell("P", item.vat_rate);
    setCell("Q", item.vat_amount);
  });

  // Update the range
  const lastRow = DATA_START_ROW + items.length;
  ws["!ref"] = `A1:Z${lastRow + 1}`;

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export async function getJobHistory(
  prisma: PrismaClient,
  limit = 20
) {
  return prisma.tax_export_jobs.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      items: {
        select: {
          id: true,
          status: true,
          guest_name: true,
          invoice_number: true,
          total_amount: true,
          needs_review_reason: true,
        },
      },
    },
  });
}

export async function getJobById(prisma: PrismaClient, jobId: string) {
  return prisma.tax_export_jobs.findUnique({
    where: { id: jobId },
    include: { items: true },
  });
}
