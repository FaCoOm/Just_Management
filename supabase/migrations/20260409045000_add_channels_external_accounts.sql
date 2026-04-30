/*
  # Add provider channels and external accounts

  - Creates the provider registry (`channels`)
  - Creates the provider-edge account layer (`external_accounts`)
  - Seeds the current Airbnb channel and three known accounts
  - Enables RLS with demo-read policies for active rows
*/

CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS channels_set_updated_at ON channels;
CREATE TRIGGER channels_set_updated_at
BEFORE UPDATE ON channels
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for channels" ON channels;
CREATE POLICY "Allow public read for channels"
  ON channels
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS external_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
  account_key text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  archived_at timestamptz,
  last_synced_at timestamptz,
  last_sync_started_at timestamptz,
  last_sync_error text,
  sync_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_accounts_account_key_format CHECK (account_key = lower(account_key)),
  CONSTRAINT external_accounts_account_key_not_blank CHECK (length(trim(account_key)) > 0),
  CONSTRAINT external_accounts_display_name_not_blank CHECK (length(trim(display_name)) > 0),
  CONSTRAINT external_accounts_unique_account_key_per_channel UNIQUE (channel_id, account_key)
);

DROP TRIGGER IF EXISTS external_accounts_set_updated_at ON external_accounts;
CREATE TRIGGER external_accounts_set_updated_at
BEFORE UPDATE ON external_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE external_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for active external accounts" ON external_accounts;
CREATE POLICY "Allow public read for active external accounts"
  ON external_accounts
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

INSERT INTO channels (slug, display_name, status)
VALUES ('airbnb', 'Airbnb', 'active')
ON CONFLICT (slug) DO UPDATE
SET display_name = EXCLUDED.display_name,
    status = EXCLUDED.status;

WITH airbnb_channel AS (
  SELECT id
  FROM channels
  WHERE slug = 'airbnb'
)
INSERT INTO external_accounts (
  channel_id,
  account_key,
  display_name,
  status,
  archived_at,
  last_synced_at,
  last_sync_started_at,
  last_sync_error,
  sync_metadata
)
SELECT
  airbnb_channel.id,
  seed.account_key,
  seed.display_name,
  'active',
  NULL,
  NULL,
  NULL,
  NULL,
  seed.sync_metadata
FROM airbnb_channel
JOIN (
  VALUES
    ('main', 'Main', jsonb_build_object('source_file', 'Main.csv', 'source_row_count', 56)),
    ('ruby', 'Ruby', jsonb_build_object('source_file', 'Ruby.csv', 'source_row_count', 14)),
    ('manuka22', 'Manuka22', jsonb_build_object('source_file', 'Manuka22.csv', 'source_row_count', 5))
) AS seed(account_key, display_name, sync_metadata)
ON TRUE
ON CONFLICT (channel_id, account_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    status = EXCLUDED.status,
    archived_at = EXCLUDED.archived_at,
    sync_metadata = EXCLUDED.sync_metadata;
