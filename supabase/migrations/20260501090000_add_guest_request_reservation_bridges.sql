/*
  # Add operational bridges from guest requests to reservations

  - Adds nullable reservation and property bridges to guest_requests without removing guest_id
  - Keeps legacy guest-linked reads compatible while the frontend migrates to reservation-backed joins
  - Leaves maintenance_issues property/room anchored and explicitly outside the reservation core
*/

ALTER TABLE guest_requests
  ADD COLUMN IF NOT EXISTS reservation_id uuid,
  ADD COLUMN IF NOT EXISTS property_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'guest_requests'
      AND constraint_name = 'guest_requests_reservation_id_fkey'
  ) THEN
    ALTER TABLE guest_requests
      ADD CONSTRAINT guest_requests_reservation_id_fkey
      FOREIGN KEY (reservation_id)
      REFERENCES reservations(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'guest_requests'
      AND constraint_name = 'guest_requests_property_id_fkey'
  ) THEN
    ALTER TABLE guest_requests
      ADD CONSTRAINT guest_requests_property_id_fkey
      FOREIGN KEY (property_id)
      REFERENCES properties(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS guest_requests_guest_id_idx
  ON guest_requests (guest_id);

CREATE INDEX IF NOT EXISTS guest_requests_reservation_id_idx
  ON guest_requests (reservation_id);

CREATE INDEX IF NOT EXISTS guest_requests_property_id_idx
  ON guest_requests (property_id);

COMMENT ON TABLE guest_requests IS
  'Legacy guest-linked requests remain readable while reservation/property bridges are introduced additively.';

COMMENT ON COLUMN guest_requests.guest_id IS
  'Legacy compatibility link to guests. Keep readable until the frontend migration is complete.';

COMMENT ON TABLE guests IS
  'Legacy compatibility booking rows remain readable while the reservation core becomes the operational source of truth.';

COMMENT ON COLUMN guest_requests.reservation_id IS
  'Nullable bridge to reservations. This preserves guest_id compatibility while requests migrate to the reservation core.';

COMMENT ON COLUMN guest_requests.property_id IS
  'Nullable property bridge for direct property-scoped queries. Keep additive so legacy guest-linked rows remain valid.';

COMMENT ON TABLE maintenance_issues IS
  'Property/room anchored operational queue. This table intentionally stays independent of reservations in v1.';

COMMENT ON COLUMN maintenance_issues.property_id IS
  'Property anchor for maintenance issues. Do not re-anchor this table to reservations in the v1 bridge migration.';
