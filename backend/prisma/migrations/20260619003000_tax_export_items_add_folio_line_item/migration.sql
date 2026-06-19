ALTER TABLE "tax_export_items" ADD COLUMN "folio_line_item_id" UUID;

CREATE INDEX "tax_export_items_folio_line_item_id_idx" ON "tax_export_items"("folio_line_item_id");

ALTER TABLE "tax_export_items"
  ADD CONSTRAINT "tax_export_items_folio_line_item_id_fkey"
  FOREIGN KEY ("folio_line_item_id") REFERENCES "folio_line_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
