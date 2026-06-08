/**
 * Tax Export Service
 * Generates tax invoice export data from checkout-date reservations.
 * Follows the Vietnamese tax invoice template format.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { WithOneProviderConnector, findParserForEmail, type ParsedOtaData } from "../integrations/provider-connector";

const TEMPLATE_PATH = path.join(__dirname, "../../fixtures/Tax_export_template.xlsx");
const VIETNAM_TZ = "Asia/Ho_Chi_Minh";
const MANUAL_SCOPE_ALL = "all";

type TaxExportDbClient = PrismaClient | Prisma.TransactionClient;

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

function addDays(dateKey: string, days: number) {
  const date = toDateOnly(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
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
  schedule_enabled: boolean;
  schedule_time: string;
  schedule_timezone: string;
  sheet_id: string;
  sheet_tab: string;
  template_columns: Record<string, string>;
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

export interface TaxExportRunResult {
  jobId: string;
  items: TaxExportItemPreview[];
  checkoutDate: string;
  runStatus: "created" | "reused_completed";
  createdNewJob: boolean;
  manualScopeKey: string;
}

const DEFAULT_SETTINGS: TaxExportSettings = {
  default_buyer_label: "Khách lẻ không lấy hóa đơn",
  default_payment_method: "Chuyển khoản",
  default_unit: "Đêm",
  default_vat_rate: 8,
  service_name_template: "Dịch vụ thuê phòng ({check_in} - {check_out})",
  schedule_enabled: false,
  schedule_time: "18:00",
  schedule_timezone: "Asia/Ho_Chi_Minh",
  sheet_id: "",
  sheet_tab: "",
  template_columns: {},
};

function normalizeTemplateColumns(value: Prisma.JsonValue | null | undefined): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
    )
  );
}

function normalizeManualScopeValue(value?: string) {
  return value?.trim() || MANUAL_SCOPE_ALL;
}

function buildManualScopeKey(checkoutDate: string, propertyId?: string, reservationId?: string) {
  return [
    `checkout=${checkoutDate}`,
    `property=${normalizeManualScopeValue(propertyId)}`,
    `reservation=${normalizeManualScopeValue(reservationId)}`,
  ].join("|");
}

function buildManualTriggeredBy(manualScopeKey: string) {
  return `manual:${manualScopeKey}`;
}

function mapStoredItemToPreview(item: {
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
}): TaxExportItemPreview {
  return {
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
    guest_name: item.guest_name,
    property_name: item.property_name,
    check_in_date: item.check_in_date,
    check_out_date: item.check_out_date,
    reservation_id: item.reservation_id,
    confirmation_code: item.confirmation_code,
    status: item.status,
    needs_review_reason: item.needs_review_reason,
  };
}

async function findReusableCompletedJob(
  prisma: TaxExportDbClient,
  checkoutDate: string,
  triggeredBy: string
) {
  return prisma.tax_export_jobs.findFirst({
    where: {
      checkout_date: toDateOnly(checkoutDate),
      status: "completed",
      triggered_by: triggeredBy,
    },
    orderBy: { created_at: "desc" },
    include: {
      items: {
        orderBy: { created_at: "asc" },
      },
    },
  });
}

function buildReusedRunResult(
  existingJob: Awaited<ReturnType<typeof findReusableCompletedJob>>,
  checkoutDate: string,
  manualScopeKey: string
): TaxExportRunResult {
  if (!existingJob) {
    throw new Error("Existing completed job is required");
  }

  return {
    jobId: existingJob.id,
    items: existingJob.items.map(mapStoredItemToPreview),
    checkoutDate,
    runStatus: "reused_completed",
    createdNewJob: false,
    manualScopeKey,
  };
}

export async function getOrCreateSettings(prisma: TaxExportDbClient): Promise<TaxExportSettings> {
  const existing = await prisma.tax_export_settings.findFirst();
  if (existing) {
    return {
      default_buyer_label: existing.default_buyer_label,
      default_payment_method: existing.default_payment_method,
      default_unit: existing.default_unit,
      default_vat_rate: existing.default_vat_rate,
      service_name_template: existing.service_name_template,
      schedule_enabled: existing.schedule_enabled,
      schedule_time: existing.schedule_time,
      schedule_timezone: existing.schedule_timezone,
      sheet_id: existing.sheet_id,
      sheet_tab: existing.sheet_tab,
      template_columns: normalizeTemplateColumns(existing.template_columns),
    };
  }
  const created = await prisma.tax_export_settings.create({ data: {} });
  return {
    default_buyer_label: created.default_buyer_label,
    default_payment_method: created.default_payment_method,
    default_unit: created.default_unit,
    default_vat_rate: created.default_vat_rate,
    service_name_template: created.service_name_template,
    schedule_enabled: created.schedule_enabled,
    schedule_time: created.schedule_time,
    schedule_timezone: created.schedule_timezone,
    sheet_id: created.sheet_id,
    sheet_tab: created.sheet_tab,
    template_columns: normalizeTemplateColumns(created.template_columns),
  };
}

export async function previewTaxExport(
  prisma: TaxExportDbClient,
  checkoutDate?: string,
  propertyId?: string,
  reservationId?: string
): Promise<{ items: TaxExportItemPreview[]; checkoutDate: string }> {
  const dateKey = checkoutDate || getVietnamToday();
  const settings = await getOrCreateSettings(prisma);

  const where: any = {
    check_out_date: toDateOnly(dateKey),
    status: { notIn: ["cancelled", "no_show"] },
  };
  if (propertyId) where.property_id = propertyId;
  if (reservationId) where.id = reservationId;

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
  propertyId?: string,
  reservationId?: string
): Promise<TaxExportRunResult> {
  const dateKey = checkoutDate || getVietnamToday();
  const manualScopeKey = buildManualScopeKey(dateKey, propertyId, reservationId);
  const triggeredBy = buildManualTriggeredBy(manualScopeKey);

  // 1. Gmail Scanning & Database Enrichment (before transaction)
  const connectionKey = process.env.ONE_CONNECTION_KEY;
  if (connectionKey && connectionKey !== "conn_dev_replace_me") {
    const connector = new WithOneProviderConnector(connectionKey);
    try {
      // Search emails from the day before to the day after
      const afterDate = addDays(dateKey, -1);
      const emails = await connector.listEmails({ after: afterDate });

      const parsedDataList: ParsedOtaData[] = [];
      for (const email of emails) {
        const parser = findParserForEmail(email.from, email.subject);
        if (parser) {
          try {
            const body = await connector.getEmailBody(email.id);
            const parsed = parser.parseEmail({ subject: email.subject, from: email.from, body });
            if (parsed && parsed.confirmationCode) {
              parsedDataList.push(parsed);
            }
          } catch (err) {
            console.error(`Failed to fetch/parse email body for message ${email.id}:`, err);
          }
        }
      }

      // Find checkout reservations for the dateKey
      const whereClause: any = {
        check_out_date: toDateOnly(dateKey),
        status: { notIn: ["cancelled", "no_show"] },
      };
      if (propertyId) whereClause.property_id = propertyId;
      if (reservationId) whereClause.id = reservationId;

      const reservations = await prisma.reservations.findMany({
        where: whereClause,
        include: {
          reservation_external_refs: true,
        },
      });

      for (const res of reservations) {
        // Try to match with parsed OTA emails
        const match = parsedDataList.find((p) => {
          // Match by confirmation code if exists in external refs
          const hasMatchingRef = res.reservation_external_refs.some(
            (ref) => ref.confirmation_code?.toLowerCase() === p.confirmationCode?.toLowerCase()
          );
          if (hasMatchingRef) return true;

          // Match by guest name
          if (p.guestName && res.guest_name) {
            const name1 = p.guestName.toLowerCase().replace(/[^a-z0-9]/g, "");
            const name2 = res.guest_name.toLowerCase().replace(/[^a-z0-9]/g, "");
            return name1.includes(name2) || name2.includes(name1);
          }

          return false;
        });

        if (match) {
          // Calculate nightly rate
          const nights = daysBetween(toDateKey(res.check_in_date), toDateKey(res.check_out_date));
          const parsedAmount = match.amount ?? 0;
          const unitPrice = parsedAmount > 0 ? parsedAmount / nights : 0;

          // Update reservation operational notes
          let notes = res.operational_notes;
          if (unitPrice > 0) {
            if (notes.includes("nightly_rate=")) {
              notes = notes.replace(/nightly_rate=\d+(\.\d+)?/, `nightly_rate=${unitPrice}`);
            } else {
              notes = `${notes};nightly_rate=${unitPrice}`.replace(/^;/, "");
            }
          }

          await prisma.reservations.update({
            where: { id: res.id },
            data: { operational_notes: notes },
          });

          // Upsert external ref
          if (match.confirmationCode) {
            const existingRef = res.reservation_external_refs.find(
              (r) => r.confirmation_code?.toLowerCase() === match.confirmationCode?.toLowerCase()
            );
            if (!existingRef) {
              // Match channel
              const channel = await prisma.channels.findFirst({
                where: { slug: { contains: match.provider, mode: "insensitive" } },
              });
              if (channel) {
                await prisma.reservation_external_refs.create({
                  data: {
                    reservation_id: res.id,
                    channel_id: channel.id,
                    confirmation_code: match.confirmationCode,
                  },
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to sync/enrich reservations from Gmail:", err);
    }
  }

  // 2. Database Transaction
  let result: TaxExportRunResult;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        const existingJob = await findReusableCompletedJob(tx, dateKey, triggeredBy);
        if (existingJob) {
          return buildReusedRunResult(existingJob, dateKey, manualScopeKey);
        }

        const preview = await previewTaxExport(tx, dateKey, propertyId, reservationId);
        const job = await tx.tax_export_jobs.create({
          data: {
            checkout_date: toDateOnly(preview.checkoutDate),
            status: "completed",
            total_items: preview.items.length,
            exported_count: preview.items.filter((item) => item.status === "exported").length,
            failed_count: 0,
            skipped_count: 0,
            review_count: preview.items.filter((item) => item.status === "needs_review").length,
            triggered_by: triggeredBy,
            completed_at: new Date(),
          },
        });

        if (preview.items.length > 0) {
          await tx.tax_export_items.createMany({
            data: preview.items.map((item) => ({
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
            })),
          });
        }

        return {
          jobId: job.id,
          items: preview.items,
          checkoutDate: preview.checkoutDate,
          runStatus: "created",
          createdNewJob: true,
          manualScopeKey,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      const existingJob = await findReusableCompletedJob(prisma, dateKey, triggeredBy);
      if (existingJob) {
        return buildReusedRunResult(existingJob, dateKey, manualScopeKey);
      }
    }
    throw error;
  }

  // 3. Google Sheets Upsert (after transaction success)
  if (result.runStatus === "created" && result.items.length > 0) {
    const settings = await getOrCreateSettings(prisma);
    if (settings.sheet_id && connectionKey && connectionKey !== "conn_dev_replace_me") {
      const connector = new WithOneProviderConnector(connectionKey);
      try {
        const rows = result.items.map((item) => ({
          id: item.reservation_id,
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
        }));
        await connector.appendSheetRows(settings.sheet_id, rows, {
          sheetName: settings.sheet_tab || "Sheet1",
          idempotencyKeyColumn: "id",
        });
      } catch (err) {
        console.error("Failed to append rows to Google Sheets:", err);
      }
    }
  }

  return result;
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
