ALTER TABLE "tax_export_settings"
ADD COLUMN "sheet_id" TEXT NOT NULL DEFAULT '',
ADD COLUMN "sheet_tab" TEXT NOT NULL DEFAULT '',
ADD COLUMN "template_columns" JSONB NOT NULL DEFAULT '{}';
