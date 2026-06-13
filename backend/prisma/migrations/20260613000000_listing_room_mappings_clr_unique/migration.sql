-- Track B migration: composite unique constraint on listing_room_mappings.
-- Decision per ADR docs/adr/2026-06-13-listing-room-mappings-uniqueness.md.
-- Existing data (Azure 2026-06-13): zero (channel_listing_id, room_id, mapping_role)
-- duplicate groups, so this index applies cleanly. Additive only -- no drops, no
-- column changes, no Supabase RLS syntax.

CREATE UNIQUE INDEX "listing_room_mappings_clr_unique"
  ON "listing_room_mappings" ("channel_listing_id", "room_id", "mapping_role");
