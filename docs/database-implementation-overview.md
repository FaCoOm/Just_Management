# Database Implementation Overview

## Current Azure PostgreSQL connection

Connection was validated through Prisma using the root `.env` `DATABASE_URL`. The connection string targets the Azure PostgreSQL server directly and ends with `/m_management?sslmode=require`.

Validated target:

- Host: `webdbmujo.postgres.database.azure.com`
- Database: `m_management`
- Current schema: `public`
- Connected user: `mujoadminh`
- Server version: PostgreSQL 18.3 on Azure PostgreSQL
- Application tables present: 15 Track B business tables plus `_prisma_migrations`

Provider/listing and core business tables currently exist but are empty:

- `channels`: 0
- `external_accounts`: 0
- `channel_listings`: 0
- `listing_room_mappings`: 0
- `properties`: 0
- `rooms`: 0
- `reservations`: 0

## Why both `postgres` and `m_management` exist

Azure PostgreSQL Flexible Server can contain multiple databases in one server.

The visible databases are:

| Database | Owner | Purpose |
|---|---:|---|
| `postgres` | `azure_pg_admin` | Default administrative database created by PostgreSQL/Azure. Keep it as a management/bootstrap database. Do not put application tables here. |
| `m_management` | `mujoadminh` | Application database for this project. Prisma migrations and runtime queries target this database. |
| `azure_sys` | `azuresu` | Azure-managed system database. Do not modify. |
| `azure_maintenance` | `azuresu` | Azure-managed maintenance database. Do not modify. |

Short version: `postgres` is default platform/admin database; `m_management` is app database. Runtime `DATABASE_URL` ends with `/m_management?sslmode=require`, so Track B uses `m_management`.

The local `m_management/` folder is a Microsoft SQL project stub (`m_management.sqlproj`). It is not the PostgreSQL database itself. It can be used by SQL tooling, but current Track B source of truth is Prisma:

- Canonical schema: `backend/prisma/schema.prisma`
- Azure-safe migrations: `backend/prisma/migrations/`
- Runtime backend: `backend/src/index.ts`

## Current Track B schema role

Track B stores property operations and external-provider identity separately.

Core operational tables:

- `properties`
- `rooms`
- `reservations`
- `reservation_room_allocations`
- `guests` (legacy compatibility only)
- `guest_requests`
- `maintenance_issues`

Provider/account/listing edge tables:

- `channels`: provider registry, e.g. Airbnb.
- `external_accounts`: Airbnb host/co-host accounts, e.g. Mujo, Ruby, Manuka.
- `channel_listings`: provider listing identity keyed by account + provider listing ID.
- `channel_listing_aliases`: cross-account aliases or alternate names for same listing.
- `listing_room_mappings`: mapping from Airbnb listing to internal room inventory.
- `reservation_external_refs`: reservation references back to Airbnb IDs/confirmation codes.
- `provider_reservation_import_rows`: staging rows for provider imports.

This separation is important because Airbnb listing visibility is account-scoped. Same listing ID can appear in multiple host/co-host accounts; account visibility does not necessarily mean account ownership.

## Account hierarchy from `database_design/`

Source files:

- `database_design/Mujo.csv`
- `database_design/Ruby.csv`
- `database_design/Manuka.csv`

Business rule supplied:

```text
Mujo > Ruby > Manuka
```

Interpretation:

- Mujo is the superset account.
- Ruby has access to a subset of Mujo listings.
- Manuka has access to a subset of Ruby listings.
- Backward tracing starts from Manuka, then Ruby, then Mujo.

Validated hierarchy:

- Manuka rows: 4
- Ruby rows: 13
- Mujo rows: 63
- Unique listing IDs across all files: 59
- Manuka ⊂ Ruby: true
- Ruby ⊂ Mujo: true

Mujo has duplicate rows for these listing IDs:

- `1025643172367576834`
- `1243977598993622008`
- `1422216271914476686`
- `971128319108711511`

The classifier de-duplicates by ID while preserving the first row seen per account.

## Listing classification program

Program:

```text
backend/scripts/classify-airbnb-listings.ts
```

Package command:

```bash
cd backend
npm run classify:listings
```

Output:

```text
database_design/listing-account-classification.json
```

The program reads the three CSVs, validates the hierarchy, and classifies every unique Airbnb listing ID by the smallest/deepest account in the backward trace order:

```text
Manuka -> Ruby -> Mujo
```

Classification tiers:

| Tier | Rule | Meaning | Count |
|---|---|---|---:|
| `manuka_ruby_mujo` | ID exists in Manuka, Ruby, and Mujo | Listing visible to all three accounts; Manuka is deepest trace owner/canonical account for classification. | 4 |
| `ruby_mujo` | ID exists in Ruby and Mujo but not Manuka | Listing shared to Ruby but not Manuka. | 9 |
| `mujo_only` | ID exists only in Mujo | Listing only visible in the Mujo superset export. | 46 |

Each output listing includes:

- `id`: Airbnb provider listing ID.
- `canonicalAccount`: first account hit while tracing backward from Manuka.
- `visibilityTier`: one of the three tiers above.
- `visibleInAccounts`: all accounts containing that ID.
- `title` and `internalName`: taken from the canonical account row.
- `statusByAccount`: provider status per visible account.
- `sourceRows`: original CSV row per account for audit.

## How this maps to database implementation

Recommended database representation:

1. Create one Airbnb channel row in `channels`.
2. Create three rows in `external_accounts`:
   - `Mujo`
   - `Ruby`
   - `Manuka`
3. Treat each CSV row as account-scoped provider visibility.
4. Use `provider_listing_id` as the stable cross-account identity.
5. Store account-specific listing rows in `channel_listings` under their `external_account_id`.
6. Use `channel_listing_aliases` or `source_metadata` to preserve cross-account visibility and canonical trace information from `listing-account-classification.json`.

Practical import logic:

```text
For each listing ID:
  if present in Manuka:
    canonicalAccount = Manuka
    visibilityTier = manuka_ruby_mujo
  else if present in Ruby:
    canonicalAccount = Ruby
    visibilityTier = ruby_mujo
  else:
    canonicalAccount = Mujo
    visibilityTier = mujo_only
```

Why this works:

- Airbnb co-host access duplicates the same provider listing ID across account exports.
- ID equality is stronger than title/internal-name matching because names vary by locale and account.
- Backward tracing avoids wrongly assigning Manuka-accessible listings to Mujo just because Mujo is the superset.
- The Track B schema already has the correct boundary: account identity lives in `external_accounts`; provider listing identity lives in `channel_listings`; internal inventory mapping remains separate in `listing_room_mappings`.

## Current state vs next import step

Current state:

- Azure DB connection works.
- Track B schema exists in `m_management.public`.
- Listing classifier works and writes an auditable JSON output.
- Provider/listing database tables are empty.

Next step when ready:

1. Seed `channels` with Airbnb.
2. Seed `external_accounts` for Mujo, Ruby, and Manuka.
3. Import classified listing rows into `channel_listings`.
4. Store `canonicalAccount`, `visibilityTier`, and `visibleInAccounts` in `source_metadata` or a dedicated reconciliation table if long-term auditing is needed.
5. Map listings to `rooms` through `listing_room_mappings` after internal room naming is normalized.
