-- Migration: central_channel_listing_owners
-- Corrects listing ownership model to match operational intent:
--   - channel_listings remains the single canonical listing table
--   - one row per provider_listing_id from database_design/listings.csv
--   - owner records deepest hierarchy owner: mujo, ruby, or manuka
--   - previously-created subset tables are removed
--
-- Destructive by request: clears existing channel_listings data before enforcing global listing uniqueness.
-- Pattern: matches 20260525000000_pipeline_connectors/migration.sql conventions.

-- Clear dependent listing references before deleting channel_listings rows.
UPDATE "reservation_external_refs"
  SET "channel_listing_id" = NULL
  WHERE "channel_listing_id" IS NOT NULL;

UPDATE "provider_reservation_import_rows"
  SET "resolved_channel_listing_id" = NULL
  WHERE "resolved_channel_listing_id" IS NOT NULL;

DELETE FROM "channel_listing_aliases";
DELETE FROM "listing_room_mappings";
DELETE FROM "channel_listings";
DELETE FROM "seed_batches";

-- Drop no-longer-needed subset tables.
DROP TABLE IF EXISTS "channel_listings_ruby";
DROP TABLE IF EXISTS "channel_listings_manuka";

-- CreateIndex: enforce one canonical row per provider listing.
CREATE UNIQUE INDEX IF NOT EXISTS "channel_listings_provider_listing_id_key"
  ON "channel_listings" ("provider_listing_id");
