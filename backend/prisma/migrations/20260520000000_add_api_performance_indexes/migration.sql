-- Track B performance indexes for Azure PostgreSQL API query patterns.
-- Additive only: no drops, no data rewrites, no Supabase-specific features.

CREATE INDEX IF NOT EXISTS "rooms_property_id_idx" ON "rooms" ("property_id");

CREATE INDEX IF NOT EXISTS "guests_property_id_created_at_idx" ON "guests" ("property_id", "created_at");
CREATE INDEX IF NOT EXISTS "guests_room_id_idx" ON "guests" ("room_id");

CREATE INDEX IF NOT EXISTS "maintenance_issues_property_id_status_created_at_idx" ON "maintenance_issues" ("property_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "maintenance_issues_status_created_at_idx" ON "maintenance_issues" ("status", "created_at");

CREATE INDEX IF NOT EXISTS "external_accounts_channel_id_idx" ON "external_accounts" ("channel_id");

CREATE INDEX IF NOT EXISTS "reservations_property_id_status_check_in_date_check_out_date_idx" ON "reservations" ("property_id", "status", "check_in_date", "check_out_date");
CREATE INDEX IF NOT EXISTS "reservations_status_check_in_date_check_out_date_idx" ON "reservations" ("status", "check_in_date", "check_out_date");
CREATE INDEX IF NOT EXISTS "reservations_check_in_date_check_out_date_idx" ON "reservations" ("check_in_date", "check_out_date");
CREATE INDEX IF NOT EXISTS "reservations_created_at_idx" ON "reservations" ("created_at");
