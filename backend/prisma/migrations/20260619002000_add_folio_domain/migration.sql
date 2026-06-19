DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FolioStatus') THEN
    CREATE TYPE "FolioStatus" AS ENUM ('open', 'finalized', 'settled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FolioLineItemKind') THEN
    CREATE TYPE "FolioLineItemKind" AS ENUM ('charge', 'credit');
  END IF;
END $$;

CREATE TABLE "folios" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reservation_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "status" "FolioStatus" NOT NULL DEFAULT 'open',
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "subtotal_amount" INTEGER NOT NULL DEFAULT 0,
  "paid_amount" INTEGER NOT NULL DEFAULT 0,
  "balance_amount" INTEGER NOT NULL DEFAULT 0,
  "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalized_at" TIMESTAMPTZ(6),
  "settled_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "folios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "folio_line_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "folio_id" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "kind" "FolioLineItemKind" NOT NULL DEFAULT 'charge',
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_amount" INTEGER NOT NULL,
  "line_total" INTEGER NOT NULL,
  "tax_rate" INTEGER NOT NULL DEFAULT 8,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "folio_line_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "folio_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "folio_id" UUID NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'Chuyển khoản',
  "amount" INTEGER NOT NULL,
  "reference" TEXT,
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "folio_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "folios_reservation_id_key" ON "folios"("reservation_id");
CREATE INDEX "folios_property_id_idx" ON "folios"("property_id");
CREATE INDEX "folios_status_idx" ON "folios"("status");
CREATE INDEX "folio_line_items_folio_id_idx" ON "folio_line_items"("folio_id");
CREATE INDEX "folio_payments_folio_id_idx" ON "folio_payments"("folio_id");

ALTER TABLE "folios"
  ADD CONSTRAINT "folios_reservation_id_fkey"
  FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "folios"
  ADD CONSTRAINT "folios_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "folio_line_items"
  ADD CONSTRAINT "folio_line_items_folio_id_fkey"
  FOREIGN KEY ("folio_id") REFERENCES "folios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "folio_payments"
  ADD CONSTRAINT "folio_payments_folio_id_fkey"
  FOREIGN KEY ("folio_id") REFERENCES "folios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
