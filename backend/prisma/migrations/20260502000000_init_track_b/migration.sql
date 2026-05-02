-- Enable required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Trigger function for automatic updated_at timestamps
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "total_rooms" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "room_number" TEXT NOT NULL,
    "room_name" TEXT NOT NULL DEFAULT '',
    "room_type" TEXT NOT NULL DEFAULT 'Standard',
    "status" TEXT NOT NULL DEFAULT 'Vacant',
    "passcode" TEXT NOT NULL DEFAULT '',
    "floor" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "room_id" UUID,
    "guest_name" TEXT NOT NULL,
    "eta" TIMESTAMPTZ(6),
    "etd" TIMESTAMPTZ(6),
    "check_in_status" TEXT NOT NULL DEFAULT 'Pending',
    "booking_source" TEXT NOT NULL DEFAULT 'Direct',
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "guest_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_requests" (
    "id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "request_type" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservation_id" UUID,
    "property_id" UUID,

    CONSTRAINT "guest_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_issues" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "room_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'Low',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_accounts" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "account_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "archived_at" TIMESTAMPTZ(6),
    "last_synced_at" TIMESTAMPTZ(6),
    "last_sync_started_at" TIMESTAMPTZ(6),
    "last_sync_error" TEXT,
    "sync_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_listings" (
    "id" UUID NOT NULL,
    "external_account_id" UUID NOT NULL,
    "provider_listing_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "internal_name" TEXT,
    "listing_type" TEXT NOT NULL DEFAULT 'home',
    "location" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'listed',
    "public_url" TEXT,
    "host_editor_url" TEXT,
    "extracted_at" TIMESTAMPTZ(6),
    "last_synced_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),
    "source_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_listing_aliases" (
    "id" UUID NOT NULL,
    "channel_listing_id" UUID NOT NULL,
    "external_account_id" UUID NOT NULL,
    "alias_value" TEXT NOT NULL,
    "alias_type" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'active',
    "archived_at" TIMESTAMPTZ(6),
    "raw_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_listing_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_room_mappings" (
    "id" UUID NOT NULL,
    "channel_listing_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "mapping_role" TEXT NOT NULL DEFAULT 'full_occupancy',
    "status" TEXT NOT NULL DEFAULT 'active',
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT NOT NULL DEFAULT '',
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_room_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "primary_room_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "check_in_date" DATE NOT NULL,
    "check_out_date" DATE NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT,
    "guest_email" TEXT,
    "adult_count" INTEGER NOT NULL DEFAULT 1,
    "child_count" INTEGER NOT NULL DEFAULT 0,
    "infant_count" INTEGER NOT NULL DEFAULT 0,
    "guest_count" INTEGER NOT NULL DEFAULT 1,
    "operational_notes" TEXT NOT NULL DEFAULT '',
    "guest_notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_external_refs" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "external_account_id" UUID,
    "channel_listing_id" UUID,
    "provider_reservation_id" TEXT,
    "confirmation_code" TEXT,
    "raw_status" TEXT,
    "source_status" TEXT,
    "booked_at" TIMESTAMPTZ(6),
    "source_created_at" TIMESTAMPTZ(6),
    "source_updated_at" TIMESTAMPTZ(6),
    "last_synced_at" TIMESTAMPTZ(6),
    "payload_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_external_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_room_allocations" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "allocation_role" TEXT NOT NULL DEFAULT 'stay',
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_room_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_guest_reservation_backfills" (
    "id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "source_check_in_status" TEXT NOT NULL DEFAULT '',
    "source_booking_source" TEXT NOT NULL DEFAULT '',
    "field_mapping" JSONB NOT NULL DEFAULT '{}',
    "backfilled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_guest_reservation_backfills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_reservation_import_rows" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "external_account_id" UUID NOT NULL,
    "source_file" TEXT NOT NULL,
    "source_row_number" INTEGER,
    "provider_reservation_id" TEXT,
    "confirmation_code" TEXT,
    "raw_status" TEXT NOT NULL DEFAULT '',
    "guest_name" TEXT NOT NULL,
    "guest_contact" TEXT,
    "adult_count" INTEGER NOT NULL DEFAULT 0,
    "child_count" INTEGER NOT NULL DEFAULT 0,
    "infant_count" INTEGER NOT NULL DEFAULT 0,
    "guest_count" INTEGER NOT NULL DEFAULT 0,
    "check_in_date" DATE NOT NULL,
    "check_out_date" DATE NOT NULL,
    "booked_at" TIMESTAMPTZ(6),
    "provider_listing_id" TEXT,
    "listing_alias_value" TEXT,
    "raw_payload" JSONB NOT NULL DEFAULT '{}',
    "resolved_channel_listing_id" UUID,
    "resolution_status" TEXT NOT NULL DEFAULT 'pending',
    "resolution_method" TEXT,
    "resolution_notes" TEXT NOT NULL DEFAULT '',
    "reservation_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_reservation_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTriggers
DROP TRIGGER IF EXISTS channels_set_updated_at ON "channels";
CREATE TRIGGER channels_set_updated_at
BEFORE UPDATE ON "channels"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS external_accounts_set_updated_at ON "external_accounts";
CREATE TRIGGER external_accounts_set_updated_at
BEFORE UPDATE ON "external_accounts"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS channel_listings_set_updated_at ON "channel_listings";
CREATE TRIGGER channel_listings_set_updated_at
BEFORE UPDATE ON "channel_listings"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS channel_listing_aliases_set_updated_at ON "channel_listing_aliases";
CREATE TRIGGER channel_listing_aliases_set_updated_at
BEFORE UPDATE ON "channel_listing_aliases"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS listing_room_mappings_set_updated_at ON "listing_room_mappings";
CREATE TRIGGER listing_room_mappings_set_updated_at
BEFORE UPDATE ON "listing_room_mappings"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS reservations_set_updated_at ON "reservations";
CREATE TRIGGER reservations_set_updated_at
BEFORE UPDATE ON "reservations"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS reservation_external_refs_set_updated_at ON "reservation_external_refs";
CREATE TRIGGER reservation_external_refs_set_updated_at
BEFORE UPDATE ON "reservation_external_refs"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS reservation_room_allocations_set_updated_at ON "reservation_room_allocations";
CREATE TRIGGER reservation_room_allocations_set_updated_at
BEFORE UPDATE ON "reservation_room_allocations"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS provider_reservation_import_rows_set_updated_at ON "provider_reservation_import_rows";
CREATE TRIGGER provider_reservation_import_rows_set_updated_at
BEFORE UPDATE ON "provider_reservation_import_rows"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- CreateIndex
CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_id_property_id_key" ON "rooms"("id", "property_id");

-- CreateIndex
CREATE INDEX "guest_requests_guest_id_idx" ON "guest_requests"("guest_id");

-- CreateIndex
CREATE INDEX "guest_requests_property_id_idx" ON "guest_requests"("property_id");

-- CreateIndex
CREATE INDEX "guest_requests_reservation_id_idx" ON "guest_requests"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "channels_slug_key" ON "channels"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "external_accounts_channel_id_account_key_key" ON "external_accounts"("channel_id", "account_key");

-- CreateIndex
CREATE UNIQUE INDEX "external_accounts_id_channel_id_key" ON "external_accounts"("id", "channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_listings_external_account_id_provider_listing_id_key" ON "channel_listings"("external_account_id", "provider_listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_listings_id_external_account_id_key" ON "channel_listings"("id", "external_account_id");

-- CreateIndex
CREATE INDEX "channel_listing_aliases_external_account_id_alias_value_idx" ON "channel_listing_aliases"("external_account_id", "alias_value");

-- CreateIndex
CREATE UNIQUE INDEX "channel_listing_aliases_channel_listing_id_alias_value_key" ON "channel_listing_aliases"("channel_listing_id", "alias_value");

-- CreateIndex
CREATE INDEX "listing_room_mappings_channel_listing_id_room_id_idx" ON "listing_room_mappings"("channel_listing_id", "room_id");

-- CreateIndex
CREATE INDEX "reservations_property_id_check_in_date_check_out_date_idx" ON "reservations"("property_id", "check_in_date", "check_out_date");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "reservation_external_refs_reservation_id_idx" ON "reservation_external_refs"("reservation_id");

-- CreateIndex
CREATE INDEX "reservation_external_refs_channel_listing_id_idx" ON "reservation_external_refs"("channel_listing_id");

-- CreateIndex
CREATE INDEX "refs_provider_res_idx" ON "reservation_external_refs"("channel_id", "external_account_id", "provider_reservation_id");

-- CreateIndex
CREATE INDEX "refs_confirmation_idx" ON "reservation_external_refs"("channel_id", "external_account_id", "confirmation_code");

-- CreateIndex
CREATE INDEX "reservation_room_allocations_room_id_idx" ON "reservation_room_allocations"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_room_allocations_reservation_id_room_id_key" ON "reservation_room_allocations"("reservation_id", "room_id");

-- CreateIndex
CREATE INDEX "legacy_guest_reservation_backfills_reservation_id_idx" ON "legacy_guest_reservation_backfills"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_guest_reservation_backfills_guest_id_key" ON "legacy_guest_reservation_backfills"("guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_guest_reservation_backfills_reservation_id_key" ON "legacy_guest_reservation_backfills"("reservation_id");

-- CreateIndex
CREATE INDEX "provider_reservation_import_rows_resolution_status_idx" ON "provider_reservation_import_rows"("resolution_status");

-- CreateIndex
CREATE INDEX "provider_reservation_import_rows_resolved_channel_listing_i_idx" ON "provider_reservation_import_rows"("resolved_channel_listing_id");

-- CreateIndex
CREATE INDEX "provider_reservation_import_rows_external_account_id_source_idx" ON "provider_reservation_import_rows"("external_account_id", "source_file", "source_row_number");

-- CreateIndex
CREATE INDEX "provider_import_confirmation_idx" ON "provider_reservation_import_rows"("channel_id", "external_account_id", "confirmation_code");

-- CreateIndex
CREATE INDEX "provider_import_provider_res_idx" ON "provider_reservation_import_rows"("channel_id", "external_account_id", "provider_reservation_id");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_issues" ADD CONSTRAINT "maintenance_issues_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_issues" ADD CONSTRAINT "maintenance_issues_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_accounts" ADD CONSTRAINT "external_accounts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_external_account_id_fkey" FOREIGN KEY ("external_account_id") REFERENCES "external_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_listing_aliases" ADD CONSTRAINT "channel_listing_aliases_channel_listing_id_external_accoun_fkey" FOREIGN KEY ("channel_listing_id", "external_account_id") REFERENCES "channel_listings"("id", "external_account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_listing_aliases" ADD CONSTRAINT "channel_listing_aliases_external_account_id_fkey" FOREIGN KEY ("external_account_id") REFERENCES "external_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_room_mappings" ADD CONSTRAINT "listing_room_mappings_channel_listing_id_fkey" FOREIGN KEY ("channel_listing_id") REFERENCES "channel_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_room_mappings" ADD CONSTRAINT "listing_room_mappings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_primary_room_id_property_id_fkey" FOREIGN KEY ("primary_room_id", "property_id") REFERENCES "rooms"("id", "property_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_external_refs" ADD CONSTRAINT "reservation_external_refs_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_external_refs" ADD CONSTRAINT "reservation_external_refs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_external_refs" ADD CONSTRAINT "reservation_external_refs_external_account_id_channel_id_fkey" FOREIGN KEY ("external_account_id", "channel_id") REFERENCES "external_accounts"("id", "channel_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_external_refs" ADD CONSTRAINT "reservation_external_refs_channel_listing_id_external_acco_fkey" FOREIGN KEY ("channel_listing_id", "external_account_id") REFERENCES "channel_listings"("id", "external_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_room_allocations" ADD CONSTRAINT "reservation_room_allocations_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_room_allocations" ADD CONSTRAINT "reservation_room_allocations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_guest_reservation_backfills" ADD CONSTRAINT "legacy_guest_reservation_backfills_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_guest_reservation_backfills" ADD CONSTRAINT "legacy_guest_reservation_backfills_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_reservation_import_rows" ADD CONSTRAINT "provider_reservation_import_rows_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_reservation_import_rows" ADD CONSTRAINT "provider_reservation_import_rows_external_account_id_chann_fkey" FOREIGN KEY ("external_account_id", "channel_id") REFERENCES "external_accounts"("id", "channel_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_reservation_import_rows" ADD CONSTRAINT "provider_reservation_import_rows_resolved_channel_listing__fkey" FOREIGN KEY ("resolved_channel_listing_id", "external_account_id") REFERENCES "channel_listings"("id", "external_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_reservation_import_rows" ADD CONSTRAINT "provider_reservation_import_rows_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

