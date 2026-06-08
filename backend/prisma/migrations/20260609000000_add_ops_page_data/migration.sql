-- Add lean read models for currently static operations pages.

CREATE TABLE "dining_event_bookings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "venue" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "guest_count" INTEGER NOT NULL DEFAULT 1,
  "guest_name" TEXT NOT NULL,
  "property_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "notes" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dining_event_bookings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staff_members" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "property_ids" UUID[] NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "last_active_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "security_audit_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "action" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "details" TEXT NOT NULL DEFAULT '',
  "severity" TEXT NOT NULL DEFAULT 'info',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "security_audit_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "room_rates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "property_id" UUID,
  "room_type" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "base_rate_vnd" INTEGER NOT NULL,
  "rate_vnd" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "room_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_members_email_key" ON "staff_members"("email");
CREATE UNIQUE INDEX "room_rates_property_id_room_type_date_key" ON "room_rates"("property_id", "room_type", "date");

CREATE INDEX "dining_event_bookings_property_id_date_idx" ON "dining_event_bookings"("property_id", "date");
CREATE INDEX "dining_event_bookings_date_status_idx" ON "dining_event_bookings"("date", "status");
CREATE INDEX "staff_members_role_idx" ON "staff_members"("role");
CREATE INDEX "staff_members_status_idx" ON "staff_members"("status");
CREATE INDEX "security_audit_entries_timestamp_idx" ON "security_audit_entries"("timestamp");
CREATE INDEX "security_audit_entries_severity_timestamp_idx" ON "security_audit_entries"("severity", "timestamp");
CREATE INDEX "room_rates_room_type_date_idx" ON "room_rates"("room_type", "date");
CREATE INDEX "room_rates_property_id_date_idx" ON "room_rates"("property_id", "date");

ALTER TABLE "dining_event_bookings"
  ADD CONSTRAINT "dining_event_bookings_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_rates"
  ADD CONSTRAINT "room_rates_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER "set_dining_event_bookings_updated_at"
  BEFORE UPDATE ON "dining_event_bookings"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

CREATE TRIGGER "set_staff_members_updated_at"
  BEFORE UPDATE ON "staff_members"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

CREATE TRIGGER "set_room_rates_updated_at"
  BEFORE UPDATE ON "room_rates"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
