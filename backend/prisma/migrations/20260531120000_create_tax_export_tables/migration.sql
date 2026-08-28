-- Repair: tax_export_* tables were never created by any migration (created via
-- prisma db push drift on dev/prod). Fresh databases fail on the ALTER-only
-- migrations 20260531153000_add_tax_export_sheet_settings and
-- 20260619003000_tax_export_items_add_folio_line_item.
-- IF NOT EXISTS keeps already-drifted databases (prod) a no-op.
-- Column sets match schema.prisma as of the migration that precedes the first
-- ALTER; columns added by later migrations are intentionally excluded here.

CREATE TABLE IF NOT EXISTS "tax_export_settings" (
    "id" UUID NOT NULL,
    "default_buyer_label" TEXT NOT NULL DEFAULT 'Khách lẻ không lấy hóa đơn',
    "default_payment_method" TEXT NOT NULL DEFAULT 'Chuyển khoản',
    "default_unit" TEXT NOT NULL DEFAULT 'Đêm',
    "default_vat_rate" INTEGER NOT NULL DEFAULT 8,
    "service_name_template" TEXT NOT NULL DEFAULT 'Dịch vụ thuê phòng ({check_in} - {check_out})',
    "schedule_enabled" BOOLEAN NOT NULL DEFAULT false,
    "schedule_time" TEXT NOT NULL DEFAULT '18:00',
    "schedule_timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tax_export_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tax_export_jobs" (
    "id" UUID NOT NULL,
    "checkout_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "exported_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "triggered_by" TEXT NOT NULL DEFAULT 'manual',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tax_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tax_export_items" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_date" TEXT NOT NULL,
    "buyer_label" TEXT NOT NULL DEFAULT 'Khách lẻ không lấy hóa đơn',
    "payment_method" TEXT NOT NULL DEFAULT 'Chuyển khoản',
    "service_description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'Đêm',
    "quantity" INTEGER NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "vat_rate" INTEGER NOT NULL DEFAULT 8,
    "vat_amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "needs_review_reason" TEXT,
    "guest_name" TEXT NOT NULL,
    "property_name" TEXT NOT NULL,
    "check_in_date" TEXT NOT NULL,
    "check_out_date" TEXT NOT NULL,
    "confirmation_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tax_export_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tax_export_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "tax_export_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tax_export_items_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "tax_export_jobs_checkout_date_idx" ON "tax_export_jobs"("checkout_date");
CREATE INDEX IF NOT EXISTS "tax_export_jobs_status_idx" ON "tax_export_jobs"("status");
CREATE INDEX IF NOT EXISTS "tax_export_items_job_id_idx" ON "tax_export_items"("job_id");
CREATE INDEX IF NOT EXISTS "tax_export_items_reservation_id_idx" ON "tax_export_items"("reservation_id");
CREATE INDEX IF NOT EXISTS "tax_export_items_status_idx" ON "tax_export_items"("status");
