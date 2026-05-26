-- Migration: listings_owner_subsets
-- Adds owner classification to channel_listings and creates per-account subset tables:
--   - channel_listings.owner          : new column with default 'mujo' (canonical superset)
--   - channel_listings_ruby           : Ruby-account subset listings
--   - channel_listings_manuka         : Manuka-account subset listings
--
-- Additive only. No edits to existing rows; existing channel_listings rows backfill to 'mujo'.
-- Pattern: matches 20260525000000_pipeline_connectors/migration.sql conventions.

-- AlterTable: add owner column to channel_listings (default 'mujo' applies to existing rows)
ALTER TABLE "channel_listings"
  ADD COLUMN "owner" TEXT NOT NULL DEFAULT 'mujo';

-- CreateIndex
CREATE INDEX "channel_listings_owner_idx"
  ON "channel_listings" ("owner");

-- CreateTable: channel_listings_ruby
CREATE TABLE "channel_listings_ruby" (
  "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  "provider_listing_id" TEXT         NOT NULL,
  "owner"               TEXT         NOT NULL DEFAULT 'ruby',
  "title"               TEXT         NOT NULL,
  "internal_name"       TEXT,
  "listing_type"        TEXT         NOT NULL DEFAULT 'home',
  "location"            TEXT         NOT NULL DEFAULT '',
  "status"              TEXT         NOT NULL DEFAULT 'listed',
  "public_url"          TEXT,
  "host_editor_url"     TEXT,
  "extracted_at"        TIMESTAMPTZ(6),
  "last_synced_at"      TIMESTAMPTZ(6),
  "last_seen_at"        TIMESTAMPTZ(6),
  "source_metadata"     JSONB        NOT NULL DEFAULT '{}',
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT "channel_listings_ruby_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_listings_ruby_provider_listing_id_key"
  ON "channel_listings_ruby" ("provider_listing_id");
CREATE INDEX "channel_listings_ruby_owner_idx"
  ON "channel_listings_ruby" ("owner");

-- CreateTable: channel_listings_manuka
CREATE TABLE "channel_listings_manuka" (
  "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  "provider_listing_id" TEXT         NOT NULL,
  "owner"               TEXT         NOT NULL DEFAULT 'manuka',
  "title"               TEXT         NOT NULL,
  "internal_name"       TEXT,
  "listing_type"        TEXT         NOT NULL DEFAULT 'home',
  "location"            TEXT         NOT NULL DEFAULT '',
  "status"              TEXT         NOT NULL DEFAULT 'listed',
  "public_url"          TEXT,
  "host_editor_url"     TEXT,
  "extracted_at"        TIMESTAMPTZ(6),
  "last_synced_at"      TIMESTAMPTZ(6),
  "last_seen_at"        TIMESTAMPTZ(6),
  "source_metadata"     JSONB        NOT NULL DEFAULT '{}',
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT "channel_listings_manuka_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_listings_manuka_provider_listing_id_key"
  ON "channel_listings_manuka" ("provider_listing_id");
CREATE INDEX "channel_listings_manuka_owner_idx"
  ON "channel_listings_manuka" ("owner");

-- Triggers: BEFORE UPDATE set_updated_at_timestamp
-- Pattern matches existing 20260502000000_init_track_b/migration.sql usage.
DROP TRIGGER IF EXISTS channel_listings_ruby_set_updated_at ON "channel_listings_ruby";
CREATE TRIGGER channel_listings_ruby_set_updated_at
  BEFORE UPDATE ON "channel_listings_ruby"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS channel_listings_manuka_set_updated_at ON "channel_listings_manuka";
CREATE TRIGGER channel_listings_manuka_set_updated_at
  BEFORE UPDATE ON "channel_listings_manuka"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();
