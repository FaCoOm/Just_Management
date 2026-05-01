/*
  # Add legacy guest backfill and provider reservation import mapping

  - Backfills current legacy `guests` rows into `reservations` without deleting or
    renaming `guests`
  - Records the one-time guest-to-reservation bridge in
    `legacy_guest_reservation_backfills` so the backfill can be rerun safely
  - Adds provider reservation import staging with exact listing resolution through
    durable `(external_account_id, provider_listing_id)` identity or active
    `channel_listing_aliases.alias_value` matches only
  - Keeps unmatched and conflicting provider rows queryable through unmapped import
    views for manual remediation instead of guessing or discarding rows
  - Keeps provider earnings strings inside `raw_payload` / `payload_metadata` only;
    v1 intentionally does not add normalized money-management tables
*/

CREATE OR REPLACE FUNCTION normalize_legacy_guest_reservation_status(check_in_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(coalesce(check_in_status, '')))
    WHEN 'checked in' THEN 'checked_in'
    WHEN 'check-in pending' THEN 'check_in_pending'
    WHEN 'check-out pending' THEN 'check_out_pending'
    WHEN 'checked out' THEN 'checked_out'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'no show' THEN 'no_show'
    ELSE 'pending'
  END;
$$;

COMMENT ON FUNCTION normalize_legacy_guest_reservation_status(text) IS
  'Maps legacy guests.check_in_status values into reservations.status. Legacy source text remains readable on guests and in backfill metadata.';

CREATE TABLE IF NOT EXISTS legacy_guest_reservation_backfills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  source_check_in_status text NOT NULL DEFAULT '',
  source_booking_source text NOT NULL DEFAULT '',
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  backfilled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legacy_guest_reservation_backfills_unique_guest UNIQUE (guest_id),
  CONSTRAINT legacy_guest_reservation_backfills_unique_reservation UNIQUE (reservation_id)
);

COMMENT ON TABLE legacy_guest_reservation_backfills IS
  'Repeat-safe bridge for the one-time legacy guests-to-reservations backfill. Does not replace or remove guests.';

COMMENT ON COLUMN legacy_guest_reservation_backfills.field_mapping IS
  'Documents explicit source-to-target mapping: guests.property_id -> reservations.property_id, guests.room_id -> reservations.primary_room_id/allocation, guests.eta/etd -> stay dates, guests.check_in_status -> normalized reservation status, guests.guest_count -> guest/adult counts.';

CREATE INDEX IF NOT EXISTS legacy_guest_reservation_backfills_reservation_idx
  ON legacy_guest_reservation_backfills (reservation_id);

ALTER TABLE legacy_guest_reservation_backfills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for legacy guest reservation backfills" ON legacy_guest_reservation_backfills;
CREATE POLICY "Allow public read for legacy guest reservation backfills"
  ON legacy_guest_reservation_backfills
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION backfill_legacy_guests_to_reservations()
RETURNS TABLE(reservations_created integer, allocations_created integer, requests_linked integer)
LANGUAGE plpgsql
AS $$
DECLARE
  created_count integer := 0;
  allocation_count integer := 0;
  request_count integer := 0;
BEGIN
  WITH candidate_guests AS MATERIALIZED (
    SELECT
      guests.id AS guest_id,
      gen_random_uuid() AS reservation_id,
      guests.property_id,
      guests.room_id,
      normalize_legacy_guest_reservation_status(guests.check_in_status) AS reservation_status,
      coalesce(guests.eta::date, guests.created_at::date, current_date) AS check_in_date,
      CASE
        WHEN guests.etd IS NOT NULL
          AND guests.etd::date >= coalesce(guests.eta::date, guests.created_at::date, current_date)
          THEN guests.etd::date
        ELSE coalesce(guests.eta::date, guests.created_at::date, current_date)
      END AS check_out_date,
      guests.guest_name,
      greatest(coalesce(guests.guest_count, 1), 0) AS guest_count,
      guests.check_in_status,
      guests.booking_source,
      guests.is_vip,
      guests.created_at
    FROM guests
    WHERE NOT EXISTS (
      SELECT 1
      FROM legacy_guest_reservation_backfills existing_backfill
      WHERE existing_backfill.guest_id = guests.id
    )
  ),
  inserted_reservations AS (
    INSERT INTO reservations (
      id,
      property_id,
      primary_room_id,
      status,
      check_in_date,
      check_out_date,
      guest_name,
      adult_count,
      child_count,
      infant_count,
      guest_count,
      operational_notes,
      guest_notes,
      created_at
    )
    SELECT
      candidate_guests.reservation_id,
      candidate_guests.property_id,
      candidate_guests.room_id,
      candidate_guests.reservation_status,
      candidate_guests.check_in_date,
      candidate_guests.check_out_date,
      candidate_guests.guest_name,
      candidate_guests.guest_count,
      0,
      0,
      candidate_guests.guest_count,
      concat(
        'Backfilled from legacy guests row. booking_source=',
        candidate_guests.booking_source,
        '; is_vip=',
        candidate_guests.is_vip::text
      ),
      '',
      candidate_guests.created_at
    FROM candidate_guests
    RETURNING id
  ),
  inserted_backfills AS (
    INSERT INTO legacy_guest_reservation_backfills (
      guest_id,
      reservation_id,
      source_check_in_status,
      source_booking_source,
      field_mapping
    )
    SELECT
      candidate_guests.guest_id,
      candidate_guests.reservation_id,
      candidate_guests.check_in_status,
      candidate_guests.booking_source,
      jsonb_build_object(
        'property_id', 'guests.property_id -> reservations.property_id',
        'room_id', 'guests.room_id -> reservations.primary_room_id and reservation_room_allocations.room_id when present',
        'eta', 'guests.eta::date -> reservations.check_in_date; falls back to guests.created_at::date/current_date when eta is null',
        'etd', 'guests.etd::date -> reservations.check_out_date when not before check_in_date; otherwise check_in_date',
        'check_in_status', 'guests.check_in_status -> reservations.status via normalize_legacy_guest_reservation_status',
        'guest_name', 'guests.guest_name -> reservations.guest_name',
        'guest_count', 'guests.guest_count -> reservations.guest_count and adult_count',
        'booking_source', 'guests.booking_source preserved in operational_notes and this metadata',
        'is_vip', 'guests.is_vip preserved in operational_notes and this metadata'
      )
    FROM candidate_guests
    JOIN inserted_reservations
      ON inserted_reservations.id = candidate_guests.reservation_id
    ON CONFLICT (guest_id) DO NOTHING
    RETURNING reservation_id
  )
  SELECT count(*)::integer
  INTO created_count
  FROM inserted_backfills;

  WITH inserted_allocations AS (
    INSERT INTO reservation_room_allocations (
      reservation_id,
      room_id,
      allocation_role,
      sort_order,
      notes
    )
    SELECT
      legacy_backfills.reservation_id,
      guests.room_id,
      'primary',
      1,
      'Backfilled from legacy guests.room_id'
    FROM legacy_guest_reservation_backfills legacy_backfills
    JOIN guests
      ON guests.id = legacy_backfills.guest_id
    WHERE guests.room_id IS NOT NULL
    ON CONFLICT (reservation_id, room_id) DO NOTHING
    RETURNING id
  )
  SELECT count(*)::integer
  INTO allocation_count
  FROM inserted_allocations;

  UPDATE guest_requests
  SET reservation_id = legacy_backfills.reservation_id,
      property_id = guests.property_id
  FROM legacy_guest_reservation_backfills legacy_backfills
  JOIN guests
    ON guests.id = legacy_backfills.guest_id
  WHERE guest_requests.guest_id = legacy_backfills.guest_id
    AND (
      guest_requests.reservation_id IS DISTINCT FROM legacy_backfills.reservation_id
      OR guest_requests.property_id IS DISTINCT FROM guests.property_id
    );

  GET DIAGNOSTICS request_count = ROW_COUNT;

  RETURN QUERY SELECT created_count, allocation_count, request_count;
END;
$$;

COMMENT ON FUNCTION backfill_legacy_guests_to_reservations() IS
  'Repeat-safe legacy guest backfill. Initial migration calls this once; reruns only create reservations for guests not already recorded in legacy_guest_reservation_backfills.';

CREATE OR REPLACE FUNCTION normalize_provider_reservation_status(raw_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(coalesce(raw_status, '')))
    WHEN 'currently hosting' THEN 'checked_in'
    WHEN 'confirmed' THEN 'pending'
    WHEN 'review guest' THEN 'check_out_pending'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'canceled' THEN 'cancelled'
    WHEN 'no show' THEN 'no_show'
    ELSE 'pending'
  END;
$$;

COMMENT ON FUNCTION normalize_provider_reservation_status(text) IS
  'Maps provider raw reservation statuses into reservations.status while preserving raw status on reservation_external_refs.';

CREATE TABLE IF NOT EXISTS provider_reservation_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
  external_account_id uuid NOT NULL,
  source_file text NOT NULL,
  source_row_number integer,
  provider_reservation_id text,
  confirmation_code text,
  raw_status text NOT NULL DEFAULT '',
  guest_name text NOT NULL,
  guest_contact text,
  adult_count integer NOT NULL DEFAULT 0 CHECK (adult_count >= 0),
  child_count integer NOT NULL DEFAULT 0 CHECK (child_count >= 0),
  infant_count integer NOT NULL DEFAULT 0 CHECK (infant_count >= 0),
  guest_count integer NOT NULL DEFAULT 0 CHECK (guest_count >= 0),
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  booked_at timestamptz,
  provider_listing_id text,
  listing_alias_value text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_channel_listing_id uuid,
  resolution_status text NOT NULL DEFAULT 'pending' CHECK (
    resolution_status IN ('pending', 'resolved', 'unmapped', 'conflict', 'imported')
  ),
  resolution_method text CHECK (
    resolution_method IS NULL OR resolution_method IN ('provider_listing_id', 'alias', 'existing_external_ref')
  ),
  resolution_notes text NOT NULL DEFAULT '',
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_reservation_import_rows_source_file_not_blank CHECK (length(trim(source_file)) > 0),
  CONSTRAINT provider_reservation_import_rows_guest_name_not_blank CHECK (length(trim(guest_name)) > 0),
  CONSTRAINT provider_reservation_import_rows_provider_reservation_id_not_blank CHECK (
    provider_reservation_id IS NULL OR length(trim(provider_reservation_id)) > 0
  ),
  CONSTRAINT provider_reservation_import_rows_confirmation_code_not_blank CHECK (
    confirmation_code IS NULL OR length(trim(confirmation_code)) > 0
  ),
  CONSTRAINT provider_reservation_import_rows_identity_present CHECK (
    provider_reservation_id IS NOT NULL OR confirmation_code IS NOT NULL
  ),
  CONSTRAINT provider_reservation_import_rows_listing_lookup_present CHECK (
    provider_listing_id IS NOT NULL OR listing_alias_value IS NOT NULL
  ),
  CONSTRAINT provider_reservation_import_rows_provider_listing_id_not_blank CHECK (
    provider_listing_id IS NULL OR length(trim(provider_listing_id)) > 0
  ),
  CONSTRAINT provider_reservation_import_rows_listing_alias_value_not_blank CHECK (
    listing_alias_value IS NULL OR length(trim(listing_alias_value)) > 0
  ),
  CONSTRAINT provider_reservation_import_rows_check_out_not_before_check_in CHECK (check_out_date >= check_in_date),
  CONSTRAINT provider_reservation_import_rows_external_account_channel_fk
    FOREIGN KEY (external_account_id, channel_id)
    REFERENCES external_accounts(id, channel_id)
    ON DELETE RESTRICT,
  CONSTRAINT provider_reservation_import_rows_resolved_listing_account_fk
    FOREIGN KEY (resolved_channel_listing_id, external_account_id)
    REFERENCES channel_listings(id, external_account_id)
    ON DELETE RESTRICT
);

COMMENT ON TABLE provider_reservation_import_rows IS
  'Staging rows for provider reservation CSV imports. Listing resolution is exact-only through provider_listing_id or channel_listing_aliases.alias_value; unresolved rows stay queryable for manual remediation.';

COMMENT ON COLUMN provider_reservation_import_rows.raw_payload IS
  'Raw provider row payload. CSV earnings strings must remain here and in reservation_external_refs.payload_metadata only, not in normalized finance columns.';

CREATE UNIQUE INDEX IF NOT EXISTS provider_reservation_import_rows_unique_confirmation_per_account
  ON provider_reservation_import_rows (channel_id, external_account_id, confirmation_code)
  WHERE confirmation_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS provider_reservation_import_rows_unique_provider_reservation_per_account
  ON provider_reservation_import_rows (channel_id, external_account_id, provider_reservation_id)
  WHERE provider_reservation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS provider_reservation_import_rows_unique_source_row_per_account
  ON provider_reservation_import_rows (external_account_id, source_file, source_row_number)
  WHERE source_row_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_reservation_import_rows_resolution_status_idx
  ON provider_reservation_import_rows (resolution_status);

CREATE INDEX IF NOT EXISTS provider_reservation_import_rows_resolved_listing_idx
  ON provider_reservation_import_rows (resolved_channel_listing_id);

DROP TRIGGER IF EXISTS provider_reservation_import_rows_set_updated_at ON provider_reservation_import_rows;
CREATE TRIGGER provider_reservation_import_rows_set_updated_at
BEFORE UPDATE ON provider_reservation_import_rows
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE provider_reservation_import_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for provider reservation import rows" ON provider_reservation_import_rows;
CREATE POLICY "Allow public read for provider reservation import rows"
  ON provider_reservation_import_rows
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION resolve_provider_reservation_import_rows()
RETURNS TABLE(rows_resolved integer, rows_unmapped integer, rows_conflicted integer)
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_count integer := 0;
  unmapped_count integer := 0;
  conflicted_count integer := 0;
BEGIN
  WITH candidate_matches AS (
    SELECT
      import_rows.id AS import_row_id,
      durable_listing.id AS durable_listing_id,
      alias_match.channel_listing_id AS alias_listing_id,
      CASE
        WHEN durable_listing.id IS NOT NULL
          AND alias_match.channel_listing_id IS NOT NULL
          AND durable_listing.id <> alias_match.channel_listing_id
          THEN 'conflict'
        WHEN durable_listing.id IS NOT NULL OR alias_match.channel_listing_id IS NOT NULL
          THEN 'resolved'
        ELSE 'unmapped'
      END AS next_status,
      CASE
        WHEN durable_listing.id IS NOT NULL
          AND (
            alias_match.channel_listing_id IS NULL
            OR durable_listing.id = alias_match.channel_listing_id
          )
          THEN durable_listing.id
        WHEN durable_listing.id IS NULL
          THEN alias_match.channel_listing_id
        ELSE NULL
      END AS next_channel_listing_id,
      CASE
        WHEN durable_listing.id IS NOT NULL
          AND (
            alias_match.channel_listing_id IS NULL
            OR durable_listing.id = alias_match.channel_listing_id
          )
          THEN 'provider_listing_id'
        WHEN durable_listing.id IS NULL AND alias_match.channel_listing_id IS NOT NULL
          THEN 'alias'
        ELSE NULL
      END AS next_method,
      CASE
        WHEN durable_listing.id IS NOT NULL
          AND alias_match.channel_listing_id IS NOT NULL
          AND durable_listing.id <> alias_match.channel_listing_id
          THEN 'Provider listing identity and alias value resolve to different listings; manual remediation required.'
        WHEN durable_listing.id IS NOT NULL
          THEN 'Resolved by exact provider_listing_id for the same external account.'
        WHEN alias_match.channel_listing_id IS NOT NULL
          THEN 'Resolved by exact active channel_listing_aliases.alias_value for the same external account.'
        ELSE 'No exact provider_listing_id or active alias match; row remains unmapped for manual remediation.'
      END AS next_notes
    FROM provider_reservation_import_rows import_rows
    LEFT JOIN channel_listings durable_listing
      ON durable_listing.external_account_id = import_rows.external_account_id
     AND durable_listing.provider_listing_id = import_rows.provider_listing_id
     AND import_rows.provider_listing_id IS NOT NULL
    LEFT JOIN channel_listing_aliases alias_match
      ON alias_match.external_account_id = import_rows.external_account_id
     AND alias_match.alias_value = import_rows.listing_alias_value
     AND alias_match.status = 'active'
     AND import_rows.listing_alias_value IS NOT NULL
    WHERE import_rows.resolution_status IN ('pending', 'resolved', 'unmapped', 'conflict')
      AND import_rows.reservation_id IS NULL
  ),
  updated_rows AS (
    UPDATE provider_reservation_import_rows import_rows
    SET resolved_channel_listing_id = candidate_matches.next_channel_listing_id,
        resolution_status = candidate_matches.next_status,
        resolution_method = candidate_matches.next_method,
        resolution_notes = candidate_matches.next_notes
    FROM candidate_matches
    WHERE import_rows.id = candidate_matches.import_row_id
    RETURNING import_rows.resolution_status
  )
  SELECT
    count(*) FILTER (WHERE resolution_status = 'resolved')::integer,
    count(*) FILTER (WHERE resolution_status = 'unmapped')::integer,
    count(*) FILTER (WHERE resolution_status = 'conflict')::integer
  INTO resolved_count, unmapped_count, conflicted_count
  FROM updated_rows;

  RETURN QUERY SELECT resolved_count, unmapped_count, conflicted_count;
END;
$$;

COMMENT ON FUNCTION resolve_provider_reservation_import_rows() IS
  'Exact-only resolver for provider reservation import rows. It never fuzzy-matches titles and never matches channel_listings.title directly unless that title is present as an active alias.';

CREATE OR REPLACE VIEW provider_reservation_import_report AS
SELECT
  import_rows.id,
  channels.slug AS channel_slug,
  external_accounts.account_key,
  import_rows.source_file,
  import_rows.source_row_number,
  import_rows.confirmation_code,
  import_rows.provider_reservation_id,
  import_rows.raw_status,
  import_rows.guest_name,
  import_rows.check_in_date,
  import_rows.check_out_date,
  import_rows.provider_listing_id,
  import_rows.listing_alias_value,
  import_rows.resolved_channel_listing_id,
  channel_listings.provider_listing_id AS resolved_provider_listing_id,
  channel_listings.title AS resolved_listing_title,
  import_rows.resolution_status,
  import_rows.resolution_method,
  CASE
    WHEN import_rows.resolution_status = 'imported' THEN 'imported'
    WHEN import_rows.resolution_status = 'conflict' THEN 'conflicting_listing_resolution'
    WHEN import_rows.resolved_channel_listing_id IS NULL THEN 'unmapped_listing'
    WHEN NOT EXISTS (
      SELECT 1
      FROM listing_room_mappings active_mapping
      WHERE active_mapping.channel_listing_id = import_rows.resolved_channel_listing_id
        AND active_mapping.status = 'active'
    ) THEN 'unmapped_room'
    ELSE 'ready_to_import'
  END AS remediation_status,
  import_rows.resolution_notes,
  import_rows.reservation_id,
  import_rows.raw_payload,
  import_rows.created_at,
  import_rows.updated_at
FROM provider_reservation_import_rows import_rows
JOIN channels
  ON channels.id = import_rows.channel_id
JOIN external_accounts
  ON external_accounts.id = import_rows.external_account_id
LEFT JOIN channel_listings
  ON channel_listings.id = import_rows.resolved_channel_listing_id;

CREATE OR REPLACE VIEW provider_reservation_unmapped_imports AS
SELECT *
FROM provider_reservation_import_report
WHERE remediation_status IN ('unmapped_listing', 'unmapped_room', 'conflicting_listing_resolution');

CREATE OR REPLACE FUNCTION import_resolved_provider_reservation_rows()
RETURNS TABLE(rows_imported integer, rows_still_unmapped integer)
LANGUAGE plpgsql
AS $$
DECLARE
  imported_count integer := 0;
  unmapped_count integer := 0;
BEGIN
  PERFORM resolve_provider_reservation_import_rows();

  UPDATE provider_reservation_import_rows import_rows
  SET reservation_id = existing_ref.reservation_id,
      resolution_status = 'imported',
      resolution_method = 'existing_external_ref',
      resolution_notes = 'Matched an existing reservation_external_refs row by provider reservation identity.'
  FROM reservation_external_refs existing_ref
  WHERE import_rows.resolution_status = 'resolved'
    AND import_rows.reservation_id IS NULL
    AND existing_ref.channel_id = import_rows.channel_id
    AND existing_ref.external_account_id = import_rows.external_account_id
    AND (
      (import_rows.provider_reservation_id IS NOT NULL AND existing_ref.provider_reservation_id = import_rows.provider_reservation_id)
      OR (import_rows.confirmation_code IS NOT NULL AND existing_ref.confirmation_code = import_rows.confirmation_code)
    );

  WITH primary_mapping AS (
    SELECT DISTINCT ON (import_rows.id)
      import_rows.id AS import_row_id,
      room_mappings.room_id AS primary_room_id,
      rooms.property_id
    FROM provider_reservation_import_rows import_rows
    JOIN listing_room_mappings room_mappings
      ON room_mappings.channel_listing_id = import_rows.resolved_channel_listing_id
     AND room_mappings.status = 'active'
    JOIN rooms
      ON rooms.id = room_mappings.room_id
    WHERE import_rows.resolution_status = 'resolved'
      AND import_rows.reservation_id IS NULL
    ORDER BY import_rows.id, room_mappings.sort_order, room_mappings.created_at
  ),
  ready_rows AS MATERIALIZED (
    SELECT
      import_rows.*,
      gen_random_uuid() AS next_reservation_id,
      primary_mapping.property_id,
      primary_mapping.primary_room_id
    FROM provider_reservation_import_rows import_rows
    JOIN primary_mapping
      ON primary_mapping.import_row_id = import_rows.id
    WHERE NOT EXISTS (
      SELECT 1
      FROM reservation_external_refs existing_ref
      WHERE existing_ref.channel_id = import_rows.channel_id
        AND existing_ref.external_account_id = import_rows.external_account_id
        AND (
          (import_rows.provider_reservation_id IS NOT NULL AND existing_ref.provider_reservation_id = import_rows.provider_reservation_id)
          OR (import_rows.confirmation_code IS NOT NULL AND existing_ref.confirmation_code = import_rows.confirmation_code)
        )
    )
  ),
  inserted_reservations AS (
    INSERT INTO reservations (
      id,
      property_id,
      primary_room_id,
      status,
      check_in_date,
      check_out_date,
      guest_name,
      guest_phone,
      adult_count,
      child_count,
      infant_count,
      guest_count,
      operational_notes,
      guest_notes
    )
    SELECT
      ready_rows.next_reservation_id,
      ready_rows.property_id,
      ready_rows.primary_room_id,
      normalize_provider_reservation_status(ready_rows.raw_status),
      ready_rows.check_in_date,
      ready_rows.check_out_date,
      ready_rows.guest_name,
      ready_rows.guest_contact,
      ready_rows.adult_count,
      ready_rows.child_count,
      ready_rows.infant_count,
      ready_rows.guest_count,
      'Imported from provider reservation staging row via exact listing resolution.',
      ''
    FROM ready_rows
    RETURNING id
  ),
  inserted_refs AS (
    INSERT INTO reservation_external_refs (
      reservation_id,
      channel_id,
      external_account_id,
      channel_listing_id,
      provider_reservation_id,
      confirmation_code,
      raw_status,
      source_status,
      booked_at,
      payload_metadata
    )
    SELECT
      ready_rows.next_reservation_id,
      ready_rows.channel_id,
      ready_rows.external_account_id,
      ready_rows.resolved_channel_listing_id,
      ready_rows.provider_reservation_id,
      ready_rows.confirmation_code,
      ready_rows.raw_status,
      ready_rows.raw_status,
      ready_rows.booked_at,
      jsonb_strip_nulls(
        ready_rows.raw_payload || jsonb_build_object(
          'source_file', ready_rows.source_file,
          'source_row_number', ready_rows.source_row_number,
          'provider_listing_id', ready_rows.provider_listing_id,
          'listing_alias_value', ready_rows.listing_alias_value,
          'resolution_method', ready_rows.resolution_method
        )
      )
    FROM ready_rows
    JOIN inserted_reservations
      ON inserted_reservations.id = ready_rows.next_reservation_id
    RETURNING reservation_id
  ),
  inserted_allocations AS (
    INSERT INTO reservation_room_allocations (
      reservation_id,
      room_id,
      allocation_role,
      sort_order,
      notes
    )
    SELECT
      ready_rows.next_reservation_id,
      room_mappings.room_id,
      CASE WHEN room_mappings.room_id = ready_rows.primary_room_id THEN 'primary' ELSE 'stay' END,
      room_mappings.sort_order,
      'Imported from active listing_room_mappings after exact reservation import resolution.'
    FROM ready_rows
    JOIN inserted_refs
      ON inserted_refs.reservation_id = ready_rows.next_reservation_id
    JOIN listing_room_mappings room_mappings
      ON room_mappings.channel_listing_id = ready_rows.resolved_channel_listing_id
     AND room_mappings.status = 'active'
    ON CONFLICT (reservation_id, room_id) DO NOTHING
    RETURNING reservation_id
  ),
  updated_import_rows AS (
    UPDATE provider_reservation_import_rows import_rows
    SET reservation_id = ready_rows.next_reservation_id,
        resolution_status = 'imported',
        resolution_notes = 'Imported into reservations with reservation_external_refs and active room allocation rows.'
    FROM ready_rows
    JOIN inserted_refs
      ON inserted_refs.reservation_id = ready_rows.next_reservation_id
    WHERE import_rows.id = ready_rows.id
    RETURNING import_rows.id
  )
  SELECT count(*)::integer
  INTO imported_count
  FROM updated_import_rows;

  SELECT count(*)::integer
  INTO unmapped_count
  FROM provider_reservation_unmapped_imports;

  RETURN QUERY SELECT imported_count, unmapped_count;
END;
$$;

COMMENT ON FUNCTION import_resolved_provider_reservation_rows() IS
  'Imports only rows that resolved through exact durable listing identity or exact alias and have active room mappings. Unmapped/conflicting rows remain in provider_reservation_unmapped_imports.';

SELECT * FROM backfill_legacy_guests_to_reservations();
