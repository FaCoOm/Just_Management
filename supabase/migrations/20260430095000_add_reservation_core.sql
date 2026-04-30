/*
  # Add reservation core, provider reservation refs, and room allocations

  - Creates `reservations` as the authoritative operational booking core
  - Creates `reservation_external_refs` for provider/account/listing reservation identity
  - Creates `reservation_room_allocations` so one reservation can allocate one or many rooms
  - Preserves compatibility by keeping `primary_room_id` nullable and separate from allocation truth
  - Keeps provider raw statuses on the edge table; importers must map them explicitly to
    `reservations.status` (for example `Currently hosting` -> `checked_in`, `Confirmed` -> `pending`,
    while `Review guest` remains a raw edge value until import policy decides whether it is
    operationally `check_out_pending` or `checked_out`)
*/

ALTER TABLE external_accounts
  ADD CONSTRAINT external_accounts_unique_id_channel
  UNIQUE (id, channel_id);

ALTER TABLE rooms
  ADD CONSTRAINT rooms_unique_id_property
  UNIQUE (id, property_id);

CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  primary_room_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'check_in_pending',
      'checked_in',
      'check_out_pending',
      'checked_out',
      'cancelled',
      'no_show'
    )
  ),
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  guest_name text NOT NULL,
  guest_phone text,
  guest_email text,
  adult_count integer NOT NULL DEFAULT 1 CHECK (adult_count >= 0),
  child_count integer NOT NULL DEFAULT 0 CHECK (child_count >= 0),
  infant_count integer NOT NULL DEFAULT 0 CHECK (infant_count >= 0),
  guest_count integer NOT NULL DEFAULT 1 CHECK (guest_count >= 0),
  operational_notes text NOT NULL DEFAULT '',
  guest_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservations_guest_name_not_blank CHECK (length(trim(guest_name)) > 0),
  CONSTRAINT reservations_guest_email_not_blank CHECK (guest_email IS NULL OR length(trim(guest_email)) > 0),
  CONSTRAINT reservations_guest_phone_not_blank CHECK (guest_phone IS NULL OR length(trim(guest_phone)) > 0),
  CONSTRAINT reservations_check_out_not_before_check_in CHECK (check_out_date >= check_in_date),
  CONSTRAINT reservations_primary_room_property_fk
    FOREIGN KEY (primary_room_id, property_id)
    REFERENCES rooms(id, property_id)
    ON DELETE RESTRICT
);

COMMENT ON COLUMN reservations.status IS
  'Authoritative normalized operational reservation status. Provider raw statuses stay on reservation_external_refs and must be translated explicitly during import.';

COMMENT ON COLUMN reservations.primary_room_id IS
  'Nullable compatibility convenience for simple single-room reads. reservation_room_allocations remains the allocation source of truth.';

CREATE INDEX IF NOT EXISTS reservations_property_dates_idx
  ON reservations (property_id, check_in_date, check_out_date);

CREATE INDEX IF NOT EXISTS reservations_status_idx
  ON reservations (status);

DROP TRIGGER IF EXISTS reservations_set_updated_at ON reservations;
CREATE TRIGGER reservations_set_updated_at
BEFORE UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for reservations" ON reservations;
CREATE POLICY "Allow public read for reservations"
  ON reservations
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS reservation_external_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
  external_account_id uuid,
  channel_listing_id uuid,
  provider_reservation_id text,
  confirmation_code text,
  raw_status text,
  source_status text,
  booked_at timestamptz,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  last_synced_at timestamptz,
  payload_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservation_external_refs_provider_reservation_id_not_blank CHECK (
    provider_reservation_id IS NULL OR length(trim(provider_reservation_id)) > 0
  ),
  CONSTRAINT reservation_external_refs_confirmation_code_not_blank CHECK (
    confirmation_code IS NULL OR length(trim(confirmation_code)) > 0
  ),
  CONSTRAINT reservation_external_refs_identity_present CHECK (
    provider_reservation_id IS NOT NULL OR confirmation_code IS NOT NULL
  ),
  CONSTRAINT reservation_external_refs_listing_requires_external_account CHECK (
    channel_listing_id IS NULL OR external_account_id IS NOT NULL
  ),
  CONSTRAINT reservation_external_refs_external_account_channel_fk
    FOREIGN KEY (external_account_id, channel_id)
    REFERENCES external_accounts(id, channel_id)
    ON DELETE RESTRICT,
  CONSTRAINT reservation_external_refs_listing_account_fk
    FOREIGN KEY (channel_listing_id, external_account_id)
    REFERENCES channel_listings(id, external_account_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS reservation_external_refs_unique_provider_reservation_per_account
  ON reservation_external_refs (channel_id, external_account_id, provider_reservation_id)
  WHERE provider_reservation_id IS NOT NULL AND external_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reservation_external_refs_unique_provider_reservation_without_account
  ON reservation_external_refs (channel_id, provider_reservation_id)
  WHERE provider_reservation_id IS NOT NULL AND external_account_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reservation_external_refs_unique_confirmation_per_account
  ON reservation_external_refs (channel_id, external_account_id, confirmation_code)
  WHERE confirmation_code IS NOT NULL AND external_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reservation_external_refs_unique_confirmation_without_account
  ON reservation_external_refs (channel_id, confirmation_code)
  WHERE confirmation_code IS NOT NULL AND external_account_id IS NULL;

CREATE INDEX IF NOT EXISTS reservation_external_refs_reservation_idx
  ON reservation_external_refs (reservation_id);

CREATE INDEX IF NOT EXISTS reservation_external_refs_listing_idx
  ON reservation_external_refs (channel_listing_id);

DROP TRIGGER IF EXISTS reservation_external_refs_set_updated_at ON reservation_external_refs;
CREATE TRIGGER reservation_external_refs_set_updated_at
BEFORE UPDATE ON reservation_external_refs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE reservation_external_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for reservation external refs" ON reservation_external_refs;
CREATE POLICY "Allow public read for reservation external refs"
  ON reservation_external_refs
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS reservation_room_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  allocation_role text NOT NULL DEFAULT 'stay' CHECK (allocation_role IN ('stay', 'primary', 'overflow', 'split_stay')),
  sort_order integer NOT NULL DEFAULT 1 CHECK (sort_order > 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservation_room_allocations_unique_pair UNIQUE (reservation_id, room_id)
);

COMMENT ON TABLE reservation_room_allocations IS
  'Authoritative room allocation join table for reservations. Supports one-to-many room assignment without forcing the reservation row into a single-room model.';

CREATE INDEX IF NOT EXISTS reservation_room_allocations_room_idx
  ON reservation_room_allocations (room_id);

DROP TRIGGER IF EXISTS reservation_room_allocations_set_updated_at ON reservation_room_allocations;
CREATE TRIGGER reservation_room_allocations_set_updated_at
BEFORE UPDATE ON reservation_room_allocations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE reservation_room_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for reservation room allocations" ON reservation_room_allocations;
CREATE POLICY "Allow public read for reservation room allocations"
  ON reservation_room_allocations
  FOR SELECT
  TO anon, authenticated
  USING (true);
