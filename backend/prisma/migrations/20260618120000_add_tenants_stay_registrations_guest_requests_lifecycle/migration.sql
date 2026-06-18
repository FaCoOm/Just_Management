-- Track B additive migration:
--   * tenant lifecycle (tenants table, TenantStatus / DriveFolderStatus / IdDocumentType enums)
--   * stay_registrations linking property/tenant/room with drive-folder status
--   * guest_requests lifecycle fields (status / priority / assigned_to / completed_at /
--     description / updated_at) + lifecycle indexes
--
-- Additive only -- purely CREATE / ADD statements, no destructive operations,
-- no Supabase RLS syntax.
-- Omitted triggers on purpose; Prisma @updatedAt handles client writes.

-- =============================================================================
-- Enums (idempotent CREATE IF NOT EXISTS so the migration stays additive even if
-- applied out-of-order on a partially-seeded shadow DB).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenantStatus') THEN
    CREATE TYPE "TenantStatus" AS ENUM ('active', 'inactive', 'archived');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriveFolderStatus') THEN
    CREATE TYPE "DriveFolderStatus" AS ENUM ('pending', 'created', 'failed');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IdDocumentType') THEN
    CREATE TYPE "IdDocumentType" AS ENUM ('passport', 'national_id', 'drivers_license', 'other');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GuestRequestStatus') THEN
    CREATE TYPE "GuestRequestStatus" AS ENUM ('open', 'assigned', 'in_progress', 'fulfilled', 'closed', 'reopened');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StayType') THEN
    CREATE TYPE "StayType" AS ENUM ('short_term', 'long_term');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GuestRequestPriority') THEN
    CREATE TYPE "GuestRequestPriority" AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;
END
$$;

-- =============================================================================
-- tenants: long-term tenant records (long-term lease guests).
-- =============================================================================

CREATE TABLE "tenants" (
  "id"                     UUID         NOT NULL DEFAULT gen_random_uuid(),
  "property_id"            UUID         NOT NULL,
  "name"                   TEXT         NOT NULL,
  "email"                  TEXT,
  "phone"                  TEXT,
  "id_document_type"       "IdDocumentType" NOT NULL,
  "id_document_number"     TEXT         NOT NULL,
  "nationality"            TEXT,
  "lease_start"            DATE         NOT NULL,
  "lease_end"              DATE         NOT NULL,
  "monthly_rent"           INTEGER      NOT NULL,
  "deposit_amount"         INTEGER,
  "emergency_contact_name" TEXT,
  "emergency_contact_phone" TEXT,
  "notes"                  TEXT,
  "status"                 "TenantStatus" NOT NULL DEFAULT 'active',
  "is_vip"                 BOOLEAN      NOT NULL DEFAULT false,
  "created_at"             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tenants_property_id_idx"        ON "tenants" ("property_id");
CREATE INDEX "tenants_status_idx"            ON "tenants" ("status");
CREATE INDEX "tenants_property_id_status_idx" ON "tenants" ("property_id", "status");
CREATE INDEX "tenants_property_id_is_vip_idx" ON "tenants" ("property_id", "is_vip");

ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- stay_registrations: per-stay local-government registration rows.
-- Links an optional tenant (long-term) or guest to a property/room.
-- =============================================================================

CREATE TABLE "stay_registrations" (
  "id"                 UUID            NOT NULL DEFAULT gen_random_uuid(),
  "property_id"        UUID            NOT NULL,
  "tenant_id"          UUID,
  "room_id"            UUID,
  "guest_name"         TEXT            NOT NULL,
  "guest_count"        INTEGER         NOT NULL DEFAULT 1,
  "registration_date"  DATE            NOT NULL,
  "registration_number" TEXT,
  "drive_folder_id"    TEXT,
  "drive_folder_status" "DriveFolderStatus" NOT NULL DEFAULT 'pending',
  "notes"              TEXT,
  "created_at"         TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stay_registrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stay_registrations_property_id_idx"                  ON "stay_registrations" ("property_id");
CREATE INDEX "stay_registrations_tenant_id_idx"                    ON "stay_registrations" ("tenant_id");
CREATE INDEX "stay_registrations_room_id_idx"                      ON "stay_registrations" ("room_id");
CREATE INDEX "stay_registrations_registration_date_idx"            ON "stay_registrations" ("registration_date");
CREATE INDEX "stay_registrations_property_id_registration_date_idx" ON "stay_registrations" ("property_id", "registration_date");

ALTER TABLE "stay_registrations"
  ADD CONSTRAINT "stay_registrations_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stay_registrations"
  ADD CONSTRAINT "stay_registrations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stay_registrations"
  ADD CONSTRAINT "stay_registrations_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- guest_requests: extend the Track A compatibility table with lifecycle fields.
-- Existing columns (request_type, notes, is_completed, created_at, reservation_id,
-- property_id, guest_id, room_id) are untouched.
-- =============================================================================

ALTER TABLE "guest_requests"
  ADD COLUMN IF NOT EXISTS "description"  TEXT,
  ADD COLUMN IF NOT EXISTS "status"       "GuestRequestStatus"   NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS "priority"     "GuestRequestPriority" NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS "assigned_to"  TEXT,
  ADD COLUMN IF NOT EXISTS "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ(6);

-- Backfill updated_at for legacy rows that pre-date the column.
UPDATE "guest_requests"
   SET "updated_at" = "created_at"
 WHERE "updated_at" IS NULL;

CREATE INDEX IF NOT EXISTS "guest_requests_status_idx"             ON "guest_requests" ("status");
CREATE INDEX IF NOT EXISTS "guest_requests_priority_idx"           ON "guest_requests" ("priority");
CREATE INDEX IF NOT EXISTS "guest_requests_assigned_to_idx"        ON "guest_requests" ("assigned_to");
CREATE INDEX IF NOT EXISTS "guest_requests_property_id_status_idx" ON "guest_requests" ("property_id", "status");
CREATE INDEX IF NOT EXISTS "guest_requests_property_id_priority_idx" ON "guest_requests" ("property_id", "priority");
