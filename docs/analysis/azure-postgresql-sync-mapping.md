# Azure PostgreSQL Sync Mapping

> Generated: 2026-05-25  
> Scope: Track B backend, Azure PostgreSQL target, and `database_design/` source-data mapping.

## Current Azure Database

Backend uses **Azure PostgreSQL database `m_management`**, not `postgres`.

Evidence:

- `backend/.env` parses to host `webdbmujo.postgres.database.azure.com`, database `m_management`.
- `backend/.env.example:7` uses `...:5432/m_management?sslmode=require`.
- `README.md:104-105` instructs the same `DATABASE_URL` shape.
- `backend/prisma/schema.prisma:9-12` configures Prisma with `provider = "postgresql"` and `url = env("DATABASE_URL")`.

Meaning:

```text
postgresql://user:pass@host:5432/postgres      -> database = postgres
postgresql://user:pass@host:5432/m_management  -> database = m_management
```

**PostgreSQL** is the engine/server type. **`m_management`** is the application database currently targeted by the backend.

## database_design/ Analysis

| File | Role | Current sync usage |
|---|---|---|
| `database_design/Mujo.csv` | Airbnb listing export, 63 rows | Can be uploaded to `/api/ingest/listings` |
| `database_design/Ruby.csv` | Airbnb listing export, 13 rows | Can be uploaded to `/api/ingest/listings` |
| `database_design/Manuka.csv` | Airbnb listing export, 4 rows | Can be uploaded to `/api/ingest/listings` |
| `database_design/listing-account-classification.json` | Derived account/listing hierarchy analysis | Reference only; not directly consumed by backend ingest code |
| `database_design/db-schema-airbnb.md` | Original schema design proposal | Reference; partly implemented in Prisma schema |

CSV schema:

```text
ID
Title
Internal Name
Type
Location
Status
Host Editor URL
Public URL
Extracted At
```

Classification summary from `listing-account-classification.json`:

| Metric | Value |
|---|---:|
| Mujo rows | 63 |
| Ruby rows | 13 |
| Manuka rows | 4 |
| Unique listings | 59 |
| `mujo_only` listings | 46 |
| `ruby_mujo` listings | 9 |
| `manuka_ruby_mujo` listings | 4 |
| Manuka subset of Ruby | true |
| Ruby subset of Mujo | true |

Prefix distribution found in CSVs:

| Source | Prefix counts |
|---|---|
| Manuka | `LL=3`, `23=1` |
| Ruby | `LL=8`, `23=4`, `CC=1` |
| Mujo | `LL=12`, `CC=10`, `MH=9`, `TheO=9`, `23=5`, `TC=3`, `UNKNOWN=15` |

`UNKNOWN` means current parser may dead-letter those rows unless internal names match a supported prefix pattern.

## Current Sync Mechanism To Azure

```text
database_design/*.csv
  |
  | uploaded as multipart file
  v
POST /api/ingest/listings
POST /api/ingest/reservations
POST /api/ingest/google-sheets
  |
  v
backend/src/ingest/routes.ts
  |
  v
normalizer.ts
  - parseSourceFile()
  - extractListings()
  - extractReservations()
  |
  v
parser.ts
  - parseInternalName()
  - prefix -> property slug + room number
  |
  v
listings.ts / reservations.ts
  |
  v
Prisma transactions
  |
  v
Azure PostgreSQL Flexible Server
database: m_management
```

Entrypoints:

- `backend/src/index.ts:80` registers ingest routes.
- `backend/src/ingest/routes.ts:194-270` exposes:
  - `POST /api/ingest/listings`
  - `POST /api/ingest/reservations`
  - `POST /api/ingest/google-sheets`

Accepted accounts from `backend/src/ingest/contracts.ts:7`:

- `airbnb-main`
- `airbnb-ruby`
- `airbnb-manuka22`

Likely source mapping:

| Source file | `sourceAccount` |
|---|---|
| `Mujo.csv` | `airbnb-main` |
| `Ruby.csv` | `airbnb-ruby` |
| `Manuka.csv` | `airbnb-manuka22` |

## Listing Sync Path

For `POST /api/ingest/listings`:

```text
CSV row
  |
  v
extractListings()
  ID              -> providerListingId
  Title           -> title
  Internal Name   -> internalName
  Location        -> location
  raw row         -> rawPayload
  |
  v
parseInternalName()
  "LL - Coffee 1"      -> propertySlug="ll", roomNumber="Coffee 1"
  "TheO - B 16.09"     -> propertySlug="theo", roomNumber="B16.09"
  "LL - Milk 2 & Coffee 2" -> rejected as composite
  |
  v
Prisma transaction writes:
  channels
  external_accounts
  properties
  rooms
  channel_listings
  listing_room_mappings
  channel_listing_aliases
  sync_runs
  sync_dead_letters
```

Key code:

- `backend/src/ingest/normalizer.ts:113` extracts listings.
- `backend/src/ingest/parser.ts:12` lists supported prefixes: `LL`, `TheO`, `MH`, `CC`, `TC`, `23`, `TA`, `Ruby`.
- `backend/src/ingest/parser.ts:58-62` rejects composite rooms containing `&` or `and`.
- `backend/src/ingest/parser.ts:83-95` maps prefix to property slug.
- `backend/src/ingest/services/listings.ts:50-74` upserts `channels` and `external_accounts`.
- `backend/src/ingest/services/listings.ts:99-120` upserts or creates `properties` and `rooms`.
- `backend/src/ingest/services/listings.ts:136-159` upserts `channel_listings`.
- `backend/src/ingest/services/listings.ts:163-174` creates `listing_room_mappings`.
- `backend/src/ingest/services/listings.ts:242-245` writes `sync_dead_letters`.

CSV to Prisma mapping:

| CSV Field | Prisma table | Prisma field |
|---|---|---|
| `ID` | `channel_listings` | `provider_listing_id` |
| `Title` | `channel_listings` | `title` |
| `Internal Name` | `channel_listings` | `internal_name` |
| `Type` | Not fully used by current listing service | available in raw payload |
| `Location` | `channel_listings` | `location` |
| `Status` | Not fully used by current listing service | available in raw payload |
| `Host Editor URL` | Not currently written by service | schema has `host_editor_url` |
| `Public URL` | Not currently written by service | schema has `public_url` |
| `Extracted At` | Not currently written by service | schema has `extracted_at` |

Important gap: schema supports more listing fields than current sync writes. Current listing service writes `title`, `internal_name`, `location`, `last_seen_at`, and `last_synced_at`; it does **not yet persist** CSV `Status`, `Type`, `Host Editor URL`, `Public URL`, or `Extracted At`.

## Reservation Sync Path

For `POST /api/ingest/reservations`:

```text
Reservation CSV / Sheet row
  |
  v
extractReservations()
  |
  v
resolve listing by:
  1. channel_listing_aliases
  2. exact channel_listings.title
  |
  v
if resolved:
  upsert reservation
  upsert reservation_external_refs
  upsert reservation_room_allocations
if unresolved:
  sync_dead_letters
```

Tables written:

- `reservations`
- `reservation_external_refs`
- `reservation_room_allocations`
- `sync_runs`
- `sync_dead_letters`

Key code:

- `backend/src/ingest/normalizer.ts:132` extracts reservations.
- `backend/src/ingest/services/reservations.ts:96-118` resolves aliases.
- `backend/src/ingest/services/reservations.ts:120-139` resolves exact listing title.
- `backend/src/ingest/services/reservations.ts:143-152` dead-letters unresolved listings.
- `backend/src/ingest/services/reservations.ts:183-190` finds existing external ref.
- `backend/src/ingest/services/reservations.ts:204-220` updates existing reservation.
- `backend/src/ingest/services/reservations.ts:258-273` creates new reservation.
- `backend/src/ingest/services/reservations.ts:276-289` creates external ref.
- `backend/src/ingest/services/reservations.ts:291-297` creates room allocation.

## Google Sheets Sync

`POST /api/ingest/google-sheets` does not write separate business logic. It bridges Google Sheets data into the same CSV processors.

```text
Google Sheets API
  |
  v
sheets.ts resolveSheetRange()
  |
  v
valuesToCsvBuffer()
  |
  v
if targetKind=listings      -> processListingSync()
if targetKind=reservations  -> processReservationSync()
```

Key code:

- `backend/src/ingest/services/sheets.ts:28` reads sheet range.
- `backend/src/ingest/services/sheets.ts:69` converts values to CSV buffer.
- `backend/src/ingest/services/sheets.ts:97-101` delegates to listing or reservation sync.

## Data Model Buckets

Current Azure `m_management` database uses Track B Prisma schema.

```text
Core Operations
  properties
  rooms
  guests
  guest_requests
  maintenance_issues

Provider Edge
  channels
  external_accounts
  channel_listings
  channel_listing_aliases
  listing_room_mappings

Reservations
  reservations
  reservation_external_refs
  reservation_room_allocations

Import / Audit
  provider_reservation_import_rows
  sync_runs
  sync_dead_letters
  legacy_guest_reservation_backfills
```

Important nuance:

- `provider_reservation_import_rows` exists in schema, but current reservation service does **not** write into it.
- Current reservation sync writes directly into canonical `reservations`, `reservation_external_refs`, and `reservation_room_allocations`.
- `listing-account-classification.json` is **not consumed** by current code.
- `db-schema-airbnb.md` proposed a `brands` table, but current Prisma schema does **not** have `brands`.

## Visual Overview

```text
                 database_design/
        ┌─────────────┬──────────────┬──────────────┐
        │ Mujo.csv    │ Ruby.csv     │ Manuka.csv   │
        │ 63 rows     │ 13 rows      │ 4 rows       │
        └──────┬──────┴──────┬───────┴──────┬───────┘
               │             │              │
               v             v              v
       sourceAccount   sourceAccount   sourceAccount
       airbnb-main     airbnb-ruby     airbnb-manuka22
               │             │              │
               └─────────────┴──────────────┘
                             │
                             v
              POST /api/ingest/listings
                             │
                             v
              parse CSV/XLSX via xlsx
                             │
                             v
              parse Internal Name prefix
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
        v                                         v
    valid simple room                       ambiguous/composite
        │                                         │
        v                                         v
Prisma transaction                       sync_dead_letters
        │
        v
channels -> external_accounts
        │
        v
properties -> rooms
        │
        v
channel_listings -> listing_room_mappings
        │
        v
Azure PostgreSQL Flexible Server
database: m_management
```

## Bottom Line

Current backend Azure sync lands in:

```text
Azure PostgreSQL Flexible Server
host: webdbmujo.postgres.database.azure.com
database: m_management
schema: public by default unless DATABASE_URL adds ?schema=
```

`postgres` is not current app target. It is only a default database name Azure PostgreSQL may create. Current app uses `m_management` because that is the database path in `DATABASE_URL`.
