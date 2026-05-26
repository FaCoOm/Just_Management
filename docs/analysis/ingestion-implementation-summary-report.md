# Ingestion Pipeline Implementation Summary Report

## Purpose

This report summarizes the implemented ingestion-pipeline work for the Track B `m_management` Azure/Postgres backend and React webapp. It explains what was added, what user stories it addresses, how data reaches Azure PostgreSQL, what verification has passed, and why the Azure database currently does not contain every row from `database_design/Mujo.csv`.

## Implementation Scope Completed

### 1. withone integration foundation

Implemented backend withone support as a server-side integration layer:

- `backend/src/integrations/one/client.ts`
  - Shared withone HTTP passthrough client.
  - Builds passthrough URLs as `ONE_API_BASE + /passthrough + third-party API path`.
  - Sends `x-one-secret`, `x-one-connection-key`, and `x-one-action-id` headers.
  - Supports repeated query keys such as Google Sheets `ranges=A&ranges=B`.
  - Wraps upstream errors into structured `OneApiError` layers.

- `backend/src/integrations/one/auth-token.ts`
  - Issues AuthKit tokens for frontend connection flow via `POST /v1/authkit/token`.

- `backend/src/integrations/one/webhooks.ts`
  - Verifies webhook HMAC signatures.
  - Handles `connection.deleted`, `oauth.failed`, and `oauth.refreshed` events.

- `backend/src/routes/one.ts`
  - Adds backend routes:
    - `POST /api/one/auth-token`
    - `GET /api/one/connections`
    - `POST /api/one/connections`
    - `DELETE /api/one/connections/:key`
    - `POST /api/one/webhook`

- `backend/src/index.ts`
  - Registers withone routes.
  - Skips global JSON parsing for `/api/one/webhook` so raw HMAC body remains verifiable.

### 2. Prisma schema and Azure migration

Added persistent connector/runtime tables:

- `integration_connections`
  - Stores withone connection keys and safe metadata.
  - No OAuth token storage in local database.

- `watched_files`
  - Tracks folder-watcher file fingerprints.
  - Enables replay prevention via `(watch_dir, relative_path, content_sha256)` uniqueness.

- `email_import_messages`
  - Tracks Gmail message/attachment ingestion idempotency.
  - Uses `(connection_key, provider_message_id, attachment_sha256)` uniqueness.

- `seed_batches`
  - Tracks built-in seed manifest hashes and completion status.

Migration deployed:

- `backend/prisma/migrations/20260525000000_pipeline_connectors/migration.sql`

Deployment result:

- `cd backend && npm run db:deploy` succeeded against Azure PostgreSQL database `m_management` at `webdbmujo.postgres.database.azure.com:5432`.

### 3. Google Sheets and Drive via withone

Implemented withone-backed Google API adapters:

- `backend/src/integrations/one/google/sheets.ts`
  - Uses verified action IDs:
    - Sheets `values:batchGet`: `conn_mod_def::GJ30kpWG-z8::VMMRhQGBT_ei-wq4JK7Sow`
    - Sheets metadata: `conn_mod_def::GJ30jpJCuBA::-7kldtebSUeO7_FYtT48JQ`
  - Fetches sheet values as `string[][]` for existing ingest service compatibility.

- `backend/src/integrations/one/google/drive.ts`
  - Uses verified Drive `files.list` action:
    - `conn_mod_def::GJ6Rzy_a8J8::5DPVGp3fTXegRgMN4v11tA`
  - Supports listing Google Sheets files inside a Drive folder.

- `backend/src/ingest/services/sheets-one.ts`
  - Mirrors existing service-account Google Sheets ingest.
  - Converts fetched rows into CSV buffer.
  - Reuses `processListingSync` / `processReservationSync`.

- `backend/src/ingest/routes.ts`
  - `POST /api/ingest/google-sheets` now supports:
    - `INGEST_SHEETS_PROVIDER=google-sheets-direct`
    - `INGEST_SHEETS_PROVIDER=withone`
  - withone mode requires `connectionKey`.

### 4. Gmail email connector via withone

Implemented Gmail adapter and email-ingestion service:

- `backend/src/integrations/one/google/gmail.ts`
  - Verified Gmail action IDs:
    - List messages: `conn_mod_def::GJ3odOE-fdw::ijLww5s-SCSplLQtLpxkrw`
    - Get message: `conn_mod_def::GJ3ocvMGOS8::D__3BgQSSzWtDUoOqLuX2A`
    - Get attachment: `conn_mod_def::GJ3ocG2ED_w::LGrrJyM-QFmKBaHwvMWwzQ`
  - Walks Gmail payload parts and finds CSV attachments.

- `backend/src/ingest/services/email.ts`
  - Searches Gmail for CSV attachments.
  - Downloads attachment body.
  - Decodes base64url attachment data.
  - Hashes attachment bytes for idempotency.
  - Reuses `processListingSync` / `processReservationSync`.

### 5. Folder watcher

Implemented local watched-folder support:

- `backend/src/ingest/watchers/folder.ts`
  - Uses `chokidar`.
  - Watches `M_MANAGEMENT_WATCH_DIR` if configured.
  - Records `add` and `change` events into `watched_files`.
  - Computes SHA-256 file fingerprints.
  - Does not mutate business tables automatically.

- `backend/src/index.ts`
  - Starts folder watcher during backend startup.

### 6. Built-in seed service

Implemented built-in seed execution:

- `backend/src/ingest/services/seed-builtin.ts`
  - Reads `database_design/listing-account-classification.json`.
  - Uses classification manifest as the canonical seed input.
  - Upserts:
    - `channels`
    - `external_accounts`
    - `channel_listings`
  - Preserves account hierarchy from the classification manifest.
  - Tracks seed batches by manifest hash.

Important: the built-in seed service uses `listing-account-classification.json`, not raw `Mujo.csv` directly. This is intentional because the JSON is the deduplicated, hierarchy-aware artifact that reconciles Mujo/Ruby/Manuka visibility.

### 7. Pipeline run endpoint now executes real modes

`POST /api/ingest/pipeline/run` no longer only returns deferred `501`.

Now implemented:

- `mode = built-in`
  - Runs built-in seed preview or write.

- `mode = email`
  - Runs Gmail attachment ingest through withone.

- `mode = folder-watch`
  - Runs pending watched files through listing/reservation processors.

Still intentionally separate:

- `mode = google-sheets`
  - Google Sheets has its own endpoint: `POST /api/ingest/google-sheets`.

### 8. Frontend admin integrations page

Implemented frontend UI:

- `src/hooks/use-pipeline-status.ts`
- `src/hooks/use-one-connections.ts`
- `src/components/integrations/ConnectIntegrationButton.tsx`
- `src/pages/settings/integrations-page.tsx`
- route `/settings/integrations` in `src/router.tsx`
- sidebar navigation entry in `src/components/app-sidebar.tsx`

The page provides:

- Pipeline Status table.
- withone connect buttons for Google Sheets, Google Drive, Gmail.
- Connection list and disconnect action.
- Manual CSV upload UI.
- Manual pipeline run UI.

## User Stories Addressed

### Story 1: Admin reviews pipeline status

Addressed by:

- `GET /api/ingest/pipeline/status`
- `/settings/integrations` status table

Current status response includes:

- admin upload
- folder-watch
- email
- built-in
- google-sheets
- safe Google credential metadata

Secrets are not exposed.

### Story 2: Admin uploads CSV from frontend

Addressed by:

- existing `POST /api/ingest/listings`
- existing `POST /api/ingest/reservations`
- new frontend Manual CSV Upload card

The backend still requires `dryRun`.

### Story 3: Runtime watches agreed folder

Addressed by:

- `chokidar` watcher
- `watched_files` table
- `folder-watch` pipeline run mode

Watcher records files but does not auto-mutate business tables. Mutation only happens through explicit pipeline run.

### Story 4: Runtime receives CSV from email

Addressed by:

- withone Gmail adapter
- Gmail message/attachment fetch
- `email_import_messages` idempotency table
- `email` pipeline run mode

Requires a saved Gmail `connectionKey`.

### Story 5: Built-in default import seeds database

Addressed by:

- `seed-builtin.ts`
- `seed_batches`
- `built-in` pipeline run mode

The default source is `database_design/`.

### Story 6: Operator reviews failed rows

Addressed by reusing existing processors:

- `processListingSync`
- `processReservationSync`
- `sync_dead_letters`

All new ingestion paths route through those processors instead of bypassing normalizer/parser logic.

## Verification Evidence

Commands passed:

```bash
cd backend && npm run db:generate
cd backend && npm run db:validate
cd backend && npm run db:verify:migration
cd backend && npm run db:deploy
cd backend && npm run build
cd backend && npm run verify-ingestion
npm run typecheck
npm run build
```

Key verification outputs:

- Prisma migration deployed successfully to Azure PostgreSQL.
- Azure migration guard passed.
- Backend TypeScript build passed.
- Frontend typecheck passed.
- Frontend production build passed.
- Ingestion verification ended with:

```text
All verification scenarios executed successfully.
```

Manual backend QA also passed:

- `GET /api/ingest/pipeline/status` returned `200`.
- `POST /api/ingest/pipeline/run` with `mode=built-in`, `targetKind=listings`, `dryRun=true` returned:

```json
{
  "dryRun": true,
  "processed": 59,
  "errors": []
}
```

## Current Azure PostgreSQL Data State

Current query results from Azure PostgreSQL:

```json
{
  "channelListings": 4,
  "accounts": [
    {
      "account_key": "airbnb-main",
      "channel_listings": 4
    }
  ],
  "seedBatches": []
}
```

Meaning:

- Only 4 listing records currently exist in `channel_listings`.
- They came from verification fixture uploads, not from the built-in seed.
- No completed `seed_batches` row exists.
- Therefore, the built-in seed has not yet been applied in write mode.

## Why Azure Does Not Yet Contain All Data From `Mujo.csv`

There are three separate reasons.

### Reason 1: Built-in seed was only run as dry-run

Manual QA ran:

```json
{
  "mode": "built-in",
  "targetKind": "listings",
  "dryRun": true
}
```

That returned `processed: 59`, but because `dryRun=true`, the service intentionally wrote nothing to Azure PostgreSQL.

So the database still only contains verification fixture rows.

To actually write built-in data, run the same pipeline with:

```json
{
  "mode": "built-in",
  "targetKind": "listings",
  "dryRun": false
}
```

### Reason 2: `Mujo.csv` has 63 rows but only 59 unique IDs

Source counts:

```text
Mujo.csv rows = 63
Mujo.csv unique IDs = 59
```

Duplicated listing IDs in `Mujo.csv`:

```text
1025643172367576834 count=2
1243977598993622008 count=2
1422216271914476686 count=2
971128319108711511 count=2
```

The database schema uses canonical uniqueness for listings:

```text
external_account_id + provider_listing_id
```

So duplicate rows with the same Airbnb listing ID cannot and should not become duplicate canonical listings. They upsert into one row.

### Reason 3: The built-in seed uses `listing-account-classification.json`, not raw `Mujo.csv`

The current built-in seed is hierarchy-aware. It uses:

```text
database_design/listing-account-classification.json
```

That file contains:

```text
classification listings = 59
canonicalAccount Mujo = 46
canonicalAccount Ruby = 9
canonicalAccount Manuka = 4
visibilityTier mujo_only = 46
visibilityTier ruby_mujo = 9
visibilityTier manuka_ruby_mujo = 4
```

This means the seed is designed to import deduplicated, reconciled listings across Mujo/Ruby/Manuka, not every raw CSV row as a separate record.

This is correct for canonical `channel_listings`, because the user-story spec explicitly says:

- Manuka listings are subset of Ruby.
- Ruby listings are subset of Mujo.
- Default seeding should preserve hierarchy without creating duplicate canonical listings.

## What Will Happen If Built-In Seed Runs With `dryRun=false`

Expected outcome:

- `seed_batches` gets one completed row.
- `channels` gets/upserts Airbnb.
- `external_accounts` gets/upserts:
  - `airbnb-main`
  - `airbnb-ruby`
  - `airbnb-manuka22`
- `channel_listings` gets deduplicated listing rows by account visibility.

Because classification visibility expands listings across visible accounts, expected `channel_listings` count is not simply 59.

Expected rows by visibility:

```text
46 mujo_only listings -> 46 account-listing rows
9 ruby_mujo listings -> 18 account-listing rows
4 manuka_ruby_mujo listings -> 12 account-listing rows
Total expected account-listing rows -> 76
```

So after a full built-in write seed, the likely target is around 76 `channel_listings` rows, not 63.

That number is higher than Mujo.csv rows because Ruby/Manuka visibility intentionally creates separate account-listing rows for the same provider listing ID under different external accounts.

## If You Want Raw Mujo.csv Imported Exactly

That is a different behavior from the built-in hierarchy seed.

Options:

1. Use existing admin CSV upload against `/api/ingest/listings` with `sourceAccount=airbnb-main` and `dryRun=false`.
2. Add a new seed mode that imports raw CSV files directly instead of the classification manifest.
3. Modify built-in seed to process both:
   - classification manifest for canonical hierarchy
   - raw CSV rows for audit/source-row traceability

Current implementation follows option 1 and option 3 partially:

- Admin CSV upload imports raw CSV through normalizer.
- Built-in seed imports classification manifest for canonical listing/account structure.

It does not yet store every raw CSV row into a separate audit table for listing seeds. Existing row-audit table `provider_reservation_import_rows` is reservation-specific.

## Required `.env` Configuration For Full Connector Use

No `.env` change was needed for migration deploy and verification.

For full withone runtime use, configure:

```bash
ONE_SECRET_KEY=sk_live_or_sk_test_value
ONE_API_BASE=https://api.withone.ai/v1
ONE_WEBHOOK_SECRET=whsec_value_from_withone
ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE=user
ONE_DEV_TOKEN=your_local_dev_token
INGEST_SHEETS_PROVIDER=withone # only when using withone Sheets instead of service account
```

For folder watcher:

```bash
M_MANAGEMENT_WATCH_DIR=C:\path\to\imports
```

For email ingestion:

```bash
M_MANAGEMENT_EMAIL_IMPORT_ENABLED=true
M_MANAGEMENT_EMAIL_IMPORT_PROVIDER=gmail
M_MANAGEMENT_EMAIL_IMPORT_QUERY="has:attachment filename:csv newer_than:30d"
```

For old service-account Google Sheets mode:

```bash
GOOGLE_SERVICE_ACCOUNT_FILE=../credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id
```

For withone Google Sheets/Gmail runtime calls, the user must connect accounts through `/settings/integrations`, which persists a `connectionKey`.

## Current Limitation / Next Decision

The code is now capable of seeding the Azure DB, but the full built-in seed has not been executed with `dryRun=false` yet.

Decision needed:

- If the desired behavior is hierarchy-aware canonical seed, run built-in seed with `dryRun=false`.
- If the desired behavior is to mirror every row in `Mujo.csv` exactly, implement a raw CSV seed/audit mode or upload `Mujo.csv` directly as an admin CSV import.

Recommended next step:

Run the built-in seed write once:

```http
POST /api/ingest/pipeline/run
Content-Type: application/json

{
  "mode": "built-in",
  "targetKind": "listings",
  "dryRun": false
}
```

Then query `channel_listings` and `seed_batches` to verify the deduplicated hierarchy was persisted.