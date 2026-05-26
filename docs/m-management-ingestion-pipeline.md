# M Management Ingestion Pipeline

## Goal

Establish the default ingestion pipeline for the `m_management` Track B backend while deferring real CSV/source synchronization work to a later implementation phase.

This document is the planning output for the first pipeline slice. It defines user stories, database alignment, runtime components, configuration, and implementation boundaries for the automated folder/email/built-in ingestion system.

## Current Verified State

- Track B uses Express, Prisma, and Azure PostgreSQL.
- `backend/prisma/schema.prisma` is the canonical schema source.
- The current schema already includes core portfolio, inventory, provider, listing, reservation, sync run, and dead-letter tables.
- Existing ingest endpoints are:
  - `POST /api/ingest/listings`
  - `POST /api/ingest/reservations`
  - `POST /api/ingest/google-sheets`
- Existing ingestion contracts require `dryRun` for write-capable endpoints.
- `database_design/` currently provides listing seed inputs:
  - `Mujo.csv`
  - `Ruby.csv`
  - `Manuka.csv`
  - `listing-account-classification.json`
  - `db-schema-airbnb.md`

## Source Accounts

Current source accounts are:

| Source account | Meaning |
| --- | --- |
| `airbnb-main` | Primary Airbnb/Mujo source account. |
| `airbnb-ruby` | Ruby account visibility layer. |
| `airbnb-manuka22` | Manuka account visibility layer. |

The `database_design/listing-account-classification.json` hierarchy indicates Manuka listings are a subset of Ruby, and Ruby listings are a subset of Mujo. Default seeding should preserve this hierarchy without creating duplicate canonical listings.

## User Stories

### Story 1: Admin Reviews Pipeline Status

As an admin, I want to see whether ingestion automation is enabled, which folders/sources are configured, and what credentials are detected so I can understand whether the runtime pipeline is ready.

Acceptance criteria:

- Admin can request pipeline status from backend.
- Response shows enabled/disabled state for folder, email, built-in seed, and Google Sheets connectors.
- Response never exposes secrets or private keys.
- Response shows Google credential association only through safe metadata: configured env var, credential file presence, `client_email`, `project_id`, and `type` when available.
- Response marks deferred connectors as `planned`, not active.

### Story 2: Admin Uploads CSV From Frontend

As an admin, I want to upload listing or reservation CSV files from the frontend so I can manually reconcile provider data.

Acceptance criteria:

- Upload remains admin-only at authorization layer when auth is introduced.
- Upload requires `dryRun` before real mutation.
- Upload supports listings and reservations separately.
- Upload returns sync summary with processed, created, updated, skipped, deadLetters, and errors.
- This first pipeline slice does not change current CSV sync behavior.

### Story 3: Runtime Watches Agreed Folder

As an operator, I want the backend to monitor an agreed folder during runtime so changed listing and reservation files can be detected automatically.

Acceptance criteria:

- Watch folder path is configured by environment variable.
- Backend reports whether the watcher is enabled and whether the folder exists.
- File sync execution is deferred in this slice.
- Watcher must not mutate database until the later source-sync implementation is approved.
- Missing folder is reported as a configuration issue, not a startup crash.

### Story 4: Runtime Receives CSV From Email

As an admin, I want the system to eventually receive CSV attachments from email so exported provider data can enter the same ingest pipeline without manual upload.

Acceptance criteria:

- Email connector has explicit env-driven configuration state.
- Credential and mailbox details are never exposed in status responses.
- Attachment polling/fetching is deferred in this slice.
- Future email sync must route through same dry-run and sync summary model.

### Story 5: Built-In Default Import Seeds Database

As a developer/admin, I want a built-in import path from `database_design/` so a new `m_management` database can start with default listing/account data.

Acceptance criteria:

- Built-in source points at `database_design/` by default.
- Status response shows whether default source files are present.
- Actual seed execution is deferred in this slice.
- Future seed must write through current channel/listing/account tables, not parallel schema.

### Story 6: Operator Reviews Failed Rows

As an operator, I want unresolved or ambiguous rows to become dead letters so I can fix bad source data without corrupting core inventory.

Acceptance criteria:

- Existing `sync_dead_letters` remains failure sink.
- Parser ambiguity does not create rooms/properties automatically.
- Pipeline status links operationally to sync runs and dead-letter counts in later UI work.

## Schema Design

No new database schema is required for this first slice.

Current schema already supports the needed pipeline foundation:

| Need | Existing model |
| --- | --- |
| Physical properties | `properties` |
| Physical rooms | `rooms` |
| Provider registry | `channels` |
| Provider accounts | `external_accounts` |
| Channel listings | `channel_listings` |
| Account/title aliases | `channel_listing_aliases` |
| Listing-to-room mapping | `listing_room_mappings` |
| Booking source of truth | `reservations` |
| Provider booking references | `reservation_external_refs` |
| Multi-room bookings | `reservation_room_allocations` |
| Raw import traceability | `provider_reservation_import_rows` |
| Sync audit | `sync_runs` |
| Failed row audit | `sync_dead_letters` |

Later schema additions may be useful, but should wait until actual source sync behavior is approved:

- `pipeline_sources` for persisted connector definitions.
- `watched_files` for durable file fingerprints and replay prevention.
- `email_import_messages` for mailbox message idempotency.
- `seed_batches` for built-in import versioning.

## Pipeline Components

### Pipeline Status Service

Backend service that reads env configuration and reports safe status. It has no database writes.

Responsibilities:

- Resolve watch directory config.
- Resolve built-in source directory config.
- Resolve email connector config as enabled/disabled/planned.
- Resolve Google credential metadata safely.
- Report implementation phase as `scaffolded`.

### Pipeline Routes

Backend routes under `/api/ingest/pipeline`.

Initial endpoints:

- `GET /api/ingest/pipeline/status`
- `POST /api/ingest/pipeline/run`

`run` is a dry-run-only placeholder in this slice. It validates requested mode and target kind, then returns `501` for deferred source sync.

### Folder Watcher Placeholder

Runtime module that reports whether a configured folder can be watched. It does not process files in this slice.

Future sync should add:

- file stability checks
- fingerprinting
- debounce
- move-to-processed/quarantine folders
- dry-run preview before mutation

### Email Connector Placeholder

Runtime connector config only. It does not connect to Gmail/IMAP in this slice.

Future sync should add:

- mailbox provider decision
- message idempotency key
- attachment filtering
- quarantine for unsupported attachments
- dry-run preview before mutation

### Built-In Import Placeholder

Runtime source config only. It does not seed database in this slice.

Future seed should import files from `database_design/` into existing provider/listing/account tables.

## Configuration

Backend env vars:

| Variable | Purpose |
| --- | --- |
| `INGEST_PIPELINE_ENABLED` | Enables pipeline status/run scaffolding. Defaults to `true`. |
| `M_MANAGEMENT_WATCH_DIR` | External folder to inspect/watch for runtime imports. |
| `M_MANAGEMENT_BUILTIN_SOURCE_DIR` | Built-in seed source directory. Defaults to `../database_design`. |
| `M_MANAGEMENT_EMAIL_IMPORT_ENABLED` | Marks email connector as configured/planned. |
| `M_MANAGEMENT_EMAIL_IMPORT_PROVIDER` | Email provider label, for example `gmail` or `imap`. |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Preferred Google service-account JSON file. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Fallback Google credential JSON file. |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Optional default spreadsheet id. |

## Google Credential Association

Google Sheets ingestion uses service-account credentials.

Credential lookup order:

1. `GOOGLE_SERVICE_ACCOUNT_FILE`
2. `GOOGLE_APPLICATION_CREDENTIALS`

The backend uses readonly Sheets scope:

```text
https://www.googleapis.com/auth/spreadsheets.readonly
```

Safe account fields:

- `client_email`
- `project_id`
- `type`

Unsafe fields that must never be returned:

- `private_key`
- `private_key_id`
- tokens
- raw credential JSON

## Development Scope For This Slice

Included:

- Markdown specification.
- Pipeline status endpoint.
- Pipeline run placeholder endpoint.
- Safe Google credential metadata inspection.
- Folder/email/built-in connector configuration reporting.
- Verification coverage for status and deferred-run behavior.

Deferred:

- Actual folder file processing.
- Actual email attachment fetching.
- Actual built-in CSV seed execution.
- Actual Google Sheets data sync changes.
- Frontend admin UI.
- Auth/role enforcement.
- New Prisma migrations.

## Verification

Run from repository root:

```bash
npm run typecheck
npm run build
```

Run from `backend/`:

```bash
npm run build
npm run verify-ingestion
```

Expected pipeline checks:

- `GET /api/ingest/pipeline/status` returns `200`.
- Response contains connector statuses without secrets.
- `POST /api/ingest/pipeline/run` with `dryRun=true` returns `501` with structured deferred error.
- Missing `dryRun` returns `400`.
