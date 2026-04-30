/*
  # Add provider-edge listings, aliases, and listing-room mappings

  - Creates `channel_listings` for durable provider/account-scoped listing identity
  - Creates `channel_listing_aliases` for exact-match title/internal-name reconciliation
  - Creates `listing_room_mappings` for simple and composite inventory linkage to rooms
  - Seeds representative listings and aliases for `CC 402` / `CC - 402` and `LL - Milk 2 & Coffee 2`
  - Enables RLS with public demo-read policies aligned to the current environment
*/

CREATE TABLE IF NOT EXISTS channel_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_account_id uuid NOT NULL REFERENCES external_accounts(id) ON DELETE RESTRICT,
  provider_listing_id text NOT NULL,
  title text NOT NULL,
  internal_name text,
  listing_type text NOT NULL DEFAULT 'home',
  location text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'listed' CHECK (status IN ('listed', 'in_progress', 'unlisted', 'archived')),
  public_url text,
  host_editor_url text,
  extracted_at timestamptz,
  last_synced_at timestamptz,
  last_seen_at timestamptz,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_listings_provider_listing_id_not_blank CHECK (length(trim(provider_listing_id)) > 0),
  CONSTRAINT channel_listings_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT channel_listings_internal_name_not_blank CHECK (internal_name IS NULL OR length(trim(internal_name)) > 0),
  CONSTRAINT channel_listings_unique_external_listing_identity UNIQUE (external_account_id, provider_listing_id),
  CONSTRAINT channel_listings_unique_id_external_account UNIQUE (id, external_account_id)
);

DROP TRIGGER IF EXISTS channel_listings_set_updated_at ON channel_listings;
CREATE TRIGGER channel_listings_set_updated_at
BEFORE UPDATE ON channel_listings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE channel_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for active channel listings" ON channel_listings;
CREATE POLICY "Allow public read for active channel listings"
  ON channel_listings
  FOR SELECT
  TO anon, authenticated
  USING (status <> 'archived');

CREATE TABLE IF NOT EXISTS channel_listing_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_listing_id uuid NOT NULL,
  external_account_id uuid NOT NULL REFERENCES external_accounts(id) ON DELETE RESTRICT,
  alias_value text NOT NULL,
  alias_type text NOT NULL DEFAULT 'manual' CHECK (alias_type IN ('title', 'internal_name', 'reservation_title', 'manual', 'composite_label')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  archived_at timestamptz,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_listing_aliases_alias_not_blank CHECK (length(trim(alias_value)) > 0),
  CONSTRAINT channel_listing_aliases_unique_per_listing UNIQUE (channel_listing_id, alias_value),
  CONSTRAINT channel_listing_aliases_listing_account_fk
    FOREIGN KEY (channel_listing_id, external_account_id)
    REFERENCES channel_listings(id, external_account_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS channel_listing_aliases_unique_active_alias_per_account
  ON channel_listing_aliases (external_account_id, alias_value)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS channel_listing_aliases_set_updated_at ON channel_listing_aliases;
CREATE TRIGGER channel_listing_aliases_set_updated_at
BEFORE UPDATE ON channel_listing_aliases
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE channel_listing_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for active channel listing aliases" ON channel_listing_aliases;
CREATE POLICY "Allow public read for active channel listing aliases"
  ON channel_listing_aliases
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

CREATE TABLE IF NOT EXISTS listing_room_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_listing_id uuid NOT NULL REFERENCES channel_listings(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  mapping_role text NOT NULL DEFAULT 'full_occupancy' CHECK (mapping_role IN ('full_occupancy', 'composite_component')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  sort_order integer NOT NULL DEFAULT 1 CHECK (sort_order > 0),
  notes text NOT NULL DEFAULT '',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS listing_room_mappings_unique_active_pair
  ON listing_room_mappings (channel_listing_id, room_id)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS listing_room_mappings_set_updated_at ON listing_room_mappings;
CREATE TRIGGER listing_room_mappings_set_updated_at
BEFORE UPDATE ON listing_room_mappings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE listing_room_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for active listing room mappings" ON listing_room_mappings;
CREATE POLICY "Allow public read for active listing room mappings"
  ON listing_room_mappings
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

WITH seeded_accounts AS (
  SELECT
    external_accounts.id AS external_account_id,
    external_accounts.account_key
  FROM external_accounts
  JOIN channels ON channels.id = external_accounts.channel_id
  WHERE channels.slug = 'airbnb'
    AND external_accounts.account_key IN ('main', 'ruby')
),
listing_seed AS (
  SELECT
    account.external_account_id,
    seed.provider_listing_id,
    seed.title,
    seed.internal_name,
    seed.listing_type,
    seed.location,
    seed.status,
    seed.public_url,
    seed.host_editor_url,
    seed.extracted_at,
    seed.last_synced_at,
    seed.last_seen_at,
    seed.source_metadata
  FROM seeded_accounts AS account
  JOIN (
    VALUES
      (
        'main',
        '721334527290853201',
        'Cochinchine Delxue flat at the city #Central',
        'CC 402',
        'home',
        'Quận 1, Vietnam',
        'listed',
        'https://www.airbnb.co.uk/rooms/721334527290853201',
        'https://www.airbnb.co.uk/hosting/listings/editor/721334527290853201/details',
        '2026-04-08T02:53:46.250Z'::timestamptz,
        '2026-04-08T02:53:46.250Z'::timestamptz,
        '2026-04-08T02:53:46.250Z'::timestamptz,
        jsonb_build_object('source_file', 'Main.csv', 'source_row', 14, 'inventory_shape', 'simple')
      ),
      (
        'main',
        '967132428321022763',
        '#The Opera panoramic city - Saigon river view.',
        'TheO - B 16.09',
        'home',
        'Thủ Đức, Vietnam',
        'listed',
        'https://www.airbnb.co.uk/rooms/967132428321022763',
        'https://www.airbnb.co.uk/hosting/listings/editor/967132428321022763/details',
        '2026-04-08T02:53:46.250Z'::timestamptz,
        '2026-04-08T02:53:46.250Z'::timestamptz,
        '2026-04-08T02:53:46.250Z'::timestamptz,
        jsonb_build_object('source_file', 'Main.csv', 'source_row', 10, 'inventory_shape', 'simple')
      ),
      (
        'main',
        '1125771412150136916',
        'Aesthetical and comfy flat #D1 #CBD',
        'LL - C&M2',
        'home',
        'Quận 1, Vietnam',
        'listed',
        'https://www.airbnb.co.uk/rooms/1125771412150136916',
        'https://www.airbnb.co.uk/hosting/listings/editor/1125771412150136916/details',
        '2026-04-08T02:53:46.252Z'::timestamptz,
        '2026-04-08T02:53:46.252Z'::timestamptz,
        '2026-04-08T02:53:46.252Z'::timestamptz,
        jsonb_build_object('source_file', 'Main.csv', 'source_row', 39, 'inventory_shape', 'composite', 'modeled_on_alias_file', 'Ruby.csv')
      )
  ) AS seed(
    account_key,
    provider_listing_id,
    title,
    internal_name,
    listing_type,
    location,
    status,
    public_url,
    host_editor_url,
    extracted_at,
    last_synced_at,
    last_seen_at,
    source_metadata
  ) ON seed.account_key = account.account_key
)
INSERT INTO channel_listings (
  external_account_id,
  provider_listing_id,
  title,
  internal_name,
  listing_type,
  location,
  status,
  public_url,
  host_editor_url,
  extracted_at,
  last_synced_at,
  last_seen_at,
  source_metadata
)
SELECT
  listing_seed.external_account_id,
  listing_seed.provider_listing_id,
  listing_seed.title,
  listing_seed.internal_name,
  listing_seed.listing_type,
  listing_seed.location,
  listing_seed.status,
  listing_seed.public_url,
  listing_seed.host_editor_url,
  listing_seed.extracted_at,
  listing_seed.last_synced_at,
  listing_seed.last_seen_at,
  listing_seed.source_metadata
FROM listing_seed
ON CONFLICT (external_account_id, provider_listing_id) DO UPDATE
SET title = EXCLUDED.title,
    internal_name = EXCLUDED.internal_name,
    listing_type = EXCLUDED.listing_type,
    location = EXCLUDED.location,
    status = EXCLUDED.status,
    public_url = EXCLUDED.public_url,
    host_editor_url = EXCLUDED.host_editor_url,
    extracted_at = EXCLUDED.extracted_at,
    last_synced_at = EXCLUDED.last_synced_at,
    last_seen_at = EXCLUDED.last_seen_at,
    source_metadata = EXCLUDED.source_metadata;

WITH listing_targets AS (
  SELECT
    channel_listings.id AS channel_listing_id,
    channel_listings.external_account_id,
    channel_listings.provider_listing_id
  FROM channel_listings
  JOIN external_accounts ON external_accounts.id = channel_listings.external_account_id
  WHERE external_accounts.account_key = 'main'
    AND channel_listings.provider_listing_id IN (
      '721334527290853201',
      '967132428321022763',
      '1125771412150136916'
    )
)
INSERT INTO channel_listing_aliases (
  channel_listing_id,
  external_account_id,
  alias_value,
  alias_type,
  status,
  raw_metadata
)
SELECT
  listing_targets.channel_listing_id,
  listing_targets.external_account_id,
  alias_seed.alias_value,
  alias_seed.alias_type,
  'active',
  alias_seed.raw_metadata
FROM listing_targets
JOIN (
  VALUES
    ('721334527290853201', 'Cochinchine Delxue flat at the city #Central', 'title', jsonb_build_object('source_file', 'Main.csv', 'source_row', 14)),
    ('721334527290853201', 'CC 402', 'internal_name', jsonb_build_object('source_file', 'Main.csv', 'source_row', 14)),
    ('721334527290853201', 'CC - 402', 'manual', jsonb_build_object('source_file', 'Main.csv', 'source_row', 8, 'reason', 'internal-name variant for deterministic exact matching')),
    ('721334527290853201', 'Cochinchine Central D1 Cozy Compact Studio', 'reservation_title', jsonb_build_object('source_file', 'reservations_data.csv', 'source_rows', jsonb_build_array(15, 17, 23))),
    ('967132428321022763', '#The Opera panoramic city - Saigon river view.', 'title', jsonb_build_object('source_file', 'Main.csv', 'source_row', 10)),
    ('967132428321022763', 'TheO - B 16.09', 'internal_name', jsonb_build_object('source_file', 'Main.csv', 'source_row', 10)),
    ('1125771412150136916', 'Aesthetical and comfy flat #D1 #CBD', 'title', jsonb_build_object('source_file', 'Main.csv', 'source_row', 39)),
    ('1125771412150136916', 'LL - C&M2', 'internal_name', jsonb_build_object('source_file', 'Main.csv', 'source_row', 39)),
    ('1125771412150136916', 'LL - Milk 2 & Coffee 2', 'composite_label', jsonb_build_object('source_file', 'Ruby.csv', 'source_row', 5)),
    ('1125771412150136916', 'LL  - Milk 2 & Coffee 2', 'manual', jsonb_build_object('source_file', 'Ruby.csv', 'source_row', 5, 'reason', 'double-space exact alias variant'))
  ) AS alias_seed(provider_listing_id, alias_value, alias_type, raw_metadata)
  ON alias_seed.provider_listing_id = listing_targets.provider_listing_id
ON CONFLICT (channel_listing_id, alias_value) DO UPDATE
SET alias_type = EXCLUDED.alias_type,
    status = EXCLUDED.status,
    archived_at = NULL,
    raw_metadata = EXCLUDED.raw_metadata;

WITH listing_targets AS (
  SELECT
    channel_listings.id AS channel_listing_id,
    channel_listings.provider_listing_id
  FROM channel_listings
  JOIN external_accounts ON external_accounts.id = channel_listings.external_account_id
  WHERE external_accounts.account_key = 'main'
    AND channel_listings.provider_listing_id IN (
      '721334527290853201',
      '967132428321022763',
      '1125771412150136916'
    )
),
room_targets AS (
  SELECT rooms.id, properties.slug, rooms.room_number
  FROM rooms
  JOIN properties ON properties.id = rooms.property_id
  WHERE (properties.slug = 'cochinchine' AND rooms.room_number = '101')
     OR (properties.slug = 'the-opera' AND rooms.room_number = '101')
     OR (properties.slug = 'latte-lounge' AND rooms.room_number IN ('101', '102'))
)
INSERT INTO listing_room_mappings (
  channel_listing_id,
  room_id,
  mapping_role,
  status,
  sort_order,
  notes
)
SELECT
  listing_targets.channel_listing_id,
  room_targets.id,
  mapping_seed.mapping_role,
  'active',
  mapping_seed.sort_order,
  mapping_seed.notes
FROM listing_targets
JOIN (
  VALUES
    ('721334527290853201', 'cochinchine', '101', 'full_occupancy', 1, 'Simple 1:1 listing-to-room scaffold for CC 402 variants'),
    ('967132428321022763', 'the-opera', '101', 'full_occupancy', 1, 'Simple 1:1 listing-to-room scaffold for The Opera listing'),
    ('1125771412150136916', 'latte-lounge', '101', 'composite_component', 1, 'Composite listing component: Milk 2 side'),
    ('1125771412150136916', 'latte-lounge', '102', 'composite_component', 2, 'Composite listing component: Coffee 2 side')
  ) AS mapping_seed(provider_listing_id, property_slug, room_number, mapping_role, sort_order, notes)
  ON mapping_seed.provider_listing_id = listing_targets.provider_listing_id
JOIN room_targets
  ON room_targets.slug = mapping_seed.property_slug
 AND room_targets.room_number = mapping_seed.room_number
ON CONFLICT DO NOTHING;
