/**
 * Tax Export REST API routes
 */
import { type Express, type Request, type Response } from "express";
import { type PrismaClient } from "@prisma/client";
import {
  previewTaxExport,
  runTaxExport,
  generateExcelBuffer,
  getJobHistory,
  getJobById,
  getOrCreateSettings,
  type TaxExportItemPreview,
} from "./service";

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerTaxExportRoutes(app: Express, prisma: PrismaClient) {
  // Get or create settings
  app.get(
    "/api/tax-export/settings",
    asyncHandler(async (req, res) => {
      const settings = await getOrCreateSettings(prisma);
      res.json(settings);
    })
  );

  // Update settings
  app.put(
    "/api/tax-export/settings",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const existing = await prisma.tax_export_settings.findFirst();
      if (existing) {
        const updated = await prisma.tax_export_settings.update({
          where: { id: existing.id },
          data: {
            default_buyer_label: body.default_buyer_label ?? existing.default_buyer_label,
            default_payment_method: body.default_payment_method ?? existing.default_payment_method,
            default_unit: body.default_unit ?? existing.default_unit,
            default_vat_rate: body.default_vat_rate ?? existing.default_vat_rate,
            service_name_template: body.service_name_template ?? existing.service_name_template,
          },
        });
        res.json(updated);
      } else {
        const created = await prisma.tax_export_settings.create({ data: body });
        res.json(created);
      }
    })
  );

  // Preview export (dry run)
  app.get(
    "/api/tax-export/preview",
    asyncHandler(async (req, res) => {
      const checkoutDate = typeof req.query.date === "string" ? req.query.date : undefined;
      const propertyId = typeof req.query.property_id === "string" ? req.query.property_id : undefined;
      const result = await previewTaxExport(prisma, checkoutDate, propertyId);
      res.json(result);
    })
  );

  // Run export (creates job + items)
  app.post(
    "/api/tax-export/run",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const checkoutDate = body.date ?? body.checkout_date;
      const propertyId = body.property_id;
      const result = await runTaxExport(prisma, checkoutDate, propertyId);
      res.status(201).json(result);
    })
  );

  // Download export as Excel
  app.get(
    "/api/tax-export/download",
    asyncHandler(async (req, res) => {
      const jobId = typeof req.query.job_id === "string" ? req.query.job_id : undefined;
      const checkoutDate = typeof req.query.date === "string" ? req.query.date : undefined;

      let items: TaxExportItemPreview[];
      if (jobId) {
        if (!UUID_PATTERN.test(jobId)) {
          res.status(404).json({ error: "Job not found" });
          return;
        }
        const job = await getJobById(prisma, jobId);
        if (!job) {
          res.status(404).json({ error: "Job not found" });
          return;
        }
        items = job.items.map((item: {
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
        }) => ({
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
        }));
      } else {
        const preview = await previewTaxExport(prisma, checkoutDate);
        items = preview.items;
      }

      const buffer = await generateExcelBuffer(items);
      const filename = `Tax_Export_${checkoutDate || new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    })
  );

  // Get job history
  app.get(
    "/api/tax-export/jobs",
    asyncHandler(async (req, res) => {
      const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
      const jobs = await getJobHistory(prisma, limit);
      res.json(jobs);
    })
  );

  // Get single job details
  app.get(
    "/api/tax-export/jobs/:id",
    asyncHandler(async (req, res) => {
      if (!UUID_PATTERN.test(req.params.id)) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      const job = await getJobById(prisma, req.params.id);
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      res.json(job);
    })
  );

  // Update item status (mark reviewed, skip, etc.)
  app.patch(
    "/api/tax-export/items/:id",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const item = await prisma.tax_export_items.findUnique({ where: { id: req.params.id } });
      if (!item) {
        res.status(404).json({ error: "Item not found" });
        return;
      }

      const updateData: any = {};
      if (body.status) updateData.status = body.status;
      if (body.unit_price !== undefined) {
        updateData.unit_price = body.unit_price;
        updateData.total_amount = body.unit_price * item.quantity;
        updateData.vat_amount = Math.round(updateData.total_amount * item.vat_rate / 100);
      }
      if (body.needs_review_reason !== undefined) updateData.needs_review_reason = body.needs_review_reason;

      const updated = await prisma.tax_export_items.update({
        where: { id: req.params.id },
        data: updateData,
      });
      res.json(updated);
    })
  );
}
