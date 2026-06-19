-- Operations Pipeline additive migration:
--   * stay_experiences: reservation-linked stay-experience records, separate from
--     the tenant-oriented stay_registrations table.
--
-- Additive only -- purely CREATE / ADD statements, no destructive operations,
-- no Supabase RLS syntax. The StayType enum already exists (created in the
-- 20260618120000 lifecycle migration); the idempotent guard below keeps this
-- migration safe if applied against a shadow DB that lacks it.
-- Omitted triggers on purpose; Prisma @updatedAt handles client writes.

-- =============================================================================
-- Enum guard: StayType ('short_term', 'long_term') -- additive, idempotent.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StayType') THEN
    CREATE TYPE "StayType" AS ENUM ('short_term', 'long_term');
  END IF;
END
$$;

-- =============================================================================
-- stay_experiences: reservation-anchored stay-experience rows.
--   * reservation_id (required) -> reservations (CASCADE)
--   * channel_id (nullable)     -> channels (SET NULL)
--   * external_ref_id (nullable)-> reservation_external_refs (SET NULL)
--   * experience_notes / guest_request_content are free-form, default ''.
-- =============================================================================

CREATE TABLE "stay_experiences" (
  "id"                    UUID           NOT NULL DEFAULT gen_random_uuid(),
  "reservation_id"        UUID           NOT NULL,
  "channel_id"            UUID,
  "external_ref_id"       UUID,
  "platform_reference"    TEXT,
  "stay_type"             "StayType",
  "experience_notes"      TEXT           NOT NULL DEFAULT '',
  "guest_request_content" TEXT           NOT NULL DEFAULT '',
  "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stay_experiences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stay_experiences_reservation_id_platform_reference_key"
  ON "stay_experiences" ("reservation_id", "platform_reference");
CREATE INDEX "stay_experiences_reservation_id_idx" ON "stay_experiences" ("reservation_id");
CREATE INDEX "stay_experiences_channel_id_idx"     ON "stay_experiences" ("channel_id");
CREATE INDEX "stay_experiences_stay_type_idx"      ON "stay_experiences" ("stay_type");

ALTER TABLE "stay_experiences"
  ADD CONSTRAINT "stay_experiences_reservation_id_fkey"
  FOREIGN KEY ("reservation_id") REFERENCES "reservations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stay_experiences"
  ADD CONSTRAINT "stay_experiences_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "channels" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stay_experiences"
  ADD CONSTRAINT "stay_experiences_external_ref_id_fkey"
  FOREIGN KEY ("external_ref_id") REFERENCES "reservation_external_refs" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
