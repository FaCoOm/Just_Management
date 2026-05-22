# Track B Backend — Comprehensive Backend Analysis

## 1. Scope + Boundaries

**Analyzed:**

- Backend runtime: [backend/src/index.ts](../../backend/src/index.ts)
- Ingestion subsystem: [backend/src/ingest](../../backend/src/ingest)
- Prisma schema + migrations: [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma)
- Backend verification scripts: [backend/scripts](../../backend/scripts)
- Frontend REST boundary: [src/lib/repositories/rest-repositories.ts](../../src/lib/repositories/rest-repositories.ts), [src/hooks/use-dashboard-data.ts](../../src/hooks/use-dashboard-data.ts)
- Vite backend proxy: [vite.config.ts](../../vite.config.ts)

**Excluded:**

- Live Azure deployment/runtime logs.
- Actual database contents.
- Auth/RBAC implementation, because no backend auth middleware exists in observed source.
- Supabase runtime path; `supabase/migrations` treated as reference-only per repo guide.

**Evidence standard:**

- Direct source evidence used for architecture claims.
- Risks labeled as risk/inference when derived from source behavior.

---

## 2. Foundational Layer

### 2.1 Package/runtime foundation

Backend package declares Node/Express/Prisma stack in [backend/package.json](../../backend/package.json):

| Layer | Evidence | Finding |
|---|---|---|
| Runtime entry | [backend/package.json#L5-L9](../../backend/package.json#L5-L9) | `main` is `dist/index.js`; dev runs `tsx watch src/index.ts`; production start runs built JS. |
| Build | [backend/package.json#L6-L20](../../backend/package.json#L6-L20) | `npm run build` = `tsc`; `verify:all` = build + ingestion verification. |
| Database tooling | [backend/package.json#L10-L17](../../backend/package.json#L10-L17) | Prisma generate/validate/migrate/deploy/push scripts exist. |
| Ingest tooling | [backend/package.json#L18-L20](../../backend/package.json#L18-L20) | Listing classification and ingestion verification scripts exist. |
| Dependencies | [backend/package.json#L22-L31](../../backend/package.json#L22-L31) | Core deps: `express`, `@prisma/client`, `cors`, `compression`, `multer`, `xlsx`, `googleapis`. |

Root workspace scripts expose combined frontend/backend workflows in [package.json](../../package.json#L6-L15):

- `dev:all` starts Vite and backend dev together.
- `build:all` builds frontend then backend.
- `typecheck` is frontend `tsc --noEmit`.

### 2.2 Express runtime foundation

Backend main runtime is [backend/src/index.ts](../../backend/src/index.ts).

| Runtime element | File lines | Purpose |
|---|---|---|
| Env loading | [index.ts#L1](../../backend/src/index.ts#L1) | Loads `.env` via `dotenv/config`. |
| Express app | [index.ts#L14](../../backend/src/index.ts#L14) | Creates singleton Express app. |
| Prisma client | [index.ts#L15](../../backend/src/index.ts#L15) | Creates top-level Prisma client for read API routes. |
| Timezone/date constants | [index.ts#L16-L18](../../backend/src/index.ts#L16-L18) | Uses Vietnam timezone and ISO date regex for date handling. |
| Reservation status allowlist | [index.ts#L18-L26](../../backend/src/index.ts#L18-L26) | Validates reservation `status` filters. |
| CORS allowlist | [index.ts#L27-L47](../../backend/src/index.ts#L27-L47) | Allows local frontend origins by default; configurable via `ALLOWED_ORIGINS`. |
| Compression | [index.ts#L49](../../backend/src/index.ts#L49) | Enables gzip compression. |
| JSON body limit | [index.ts#L50](../../backend/src/index.ts#L50) | `express.json({ limit: "1mb" })`. |
| Ingest route registration | [index.ts#L52](../../backend/src/index.ts#L52) | Mounts ingest routes before read routes. |
| Error boundary | [index.ts#L552-L562](../../backend/src/index.ts#L552-L562) | Logs unknown errors and returns generic 500. |
| Server start | [index.ts#L568-L572](../../backend/src/index.ts#L568-L572) | Listens on `PORT` or `3001`. |
| Prisma export | [index.ts#L574](../../backend/src/index.ts#L574) | Exports Prisma client. |

**Architectural shape:** small Express monolith. Read APIs live directly in [index.ts](../../backend/src/index.ts). Ingest writes live in [backend/src/ingest](../../backend/src/ingest).

---

## 3. API Surface Inventory

### 3.1 Health

| Method | Endpoint | File | Lines | Behavior |
|---|---|---|---|---|
| GET | `/health` | [index.ts](../../backend/src/index.ts#L126-L129) | 126-129 | Returns `{ status: "ok", track: "B" }`. |

### 3.2 Read REST APIs

| Method | Endpoint | Query params | File lines | Data source / behavior |
|---|---|---|---|---|
| GET | `/api/properties` | none | [index.ts#L135-L150](../../backend/src/index.ts#L135-L150) | Returns properties ordered by name; 300s private cache. |
| GET | `/api/reservations` | `property_id`, `status`, `start_date`, `end_date`, `check_in_date`, `check_out_date`, `limit`, `offset` | [index.ts#L156-L234](../../backend/src/index.ts#L156-L234) | Returns filtered reservations + `X-Total-Count`; validates reservation status and date filters. |
| GET | `/api/stats/occupancy` | `property_id`, `days`, `end_date` | [index.ts#L236-L346](../../backend/src/index.ts#L236-L346) | Builds occupancy series by loading properties, rooms, reservations, then computing daily occupied/available rooms in memory. |
| GET | `/api/reservations/:id` | path `id` | [index.ts#L348-L358](../../backend/src/index.ts#L348-L358) | Returns reservation with `reservation_external_refs` and `reservation_room_allocations`; 404 if absent. |
| GET | `/api/rooms` | `property_id`, `limit`, `offset` | [index.ts#L364-L389](../../backend/src/index.ts#L364-L389) | Returns rooms + `X-Total-Count`; 60s private cache. |
| GET | `/api/maintenance` | `property_id`, `status`, `limit`, `offset` | [index.ts#L395-L422](../../backend/src/index.ts#L395-L422) | Returns maintenance issues ordered newest first; no-store. |
| GET | `/api/channels` | none | [index.ts#L428-L456](../../backend/src/index.ts#L428-L456) | Returns channels with nested external accounts; 300s private cache. |
| GET | `/api/external-accounts` | `channel_id` | [index.ts#L458-L479](../../backend/src/index.ts#L458-L479) | Returns external accounts, optionally filtered by channel. |
| GET | `/api/guest-requests` | `property_id`, `guest_id`, `reservation_id`, `limit`, `offset` | [index.ts#L485-L514](../../backend/src/index.ts#L485-L514) | Returns guest requests ordered newest first; no-store. |
| GET | `/api/guests` | `property_id`, `room_id`, `limit`, `offset` | [index.ts#L520-L550](../../backend/src/index.ts#L520-L550) | Returns legacy guest records; no-store. |

### 3.3 Write/import APIs

Registered by [registerIngestRoutes(app)](../../backend/src/index.ts#L52), implemented in [backend/src/ingest/routes.ts](../../backend/src/ingest/routes.ts).

| Method | Endpoint | File lines | Dispatch |
|---|---|---|---|
| POST | `/api/ingest/listings` | [routes.ts#L195-L219](../../backend/src/ingest/routes.ts#L195-L219) | Validates request; if file present, imports `processListingSync`. |
| POST | `/api/ingest/reservations` | [routes.ts#L221-L245](../../backend/src/ingest/routes.ts#L221-L245) | Validates request; if file present, imports `processReservationSync`. |
| POST | `/api/ingest/google-sheets` | [routes.ts#L247-L270](../../backend/src/ingest/routes.ts#L247-L270) | Validates Sheets contract; imports `processGoogleSheetsSync`. |

---

## 4. Request Handling + API Helpers

### 4.1 Date helpers

[backend/src/index.ts#L54-L81](../../backend/src/index.ts#L54-L81):

- `getVietnamToday()` derives date in `Asia/Ho_Chi_Minh`.
- `toDateOnly()` constructs UTC midnight date from `YYYY-MM-DD`.
- `toDateKey()` converts Date/string to ISO date key.
- `addDays()` adds UTC days.

### 4.2 Pagination

[getOptionalPagination](../../backend/src/index.ts#L89-L104):

- Accepts `limit` and `offset`.
- Defaults `limit` to `100` when pagination is requested.
- Clamps `limit` to 1..500.
- Clamps `offset` to >= 0.

### 4.3 Caching

[setShortCache / setNoStore](../../backend/src/index.ts#L106-L112):

- Short cache: `private, max-age=N, stale-while-revalidate=N`
- No-store: `Cache-Control: no-store`

Endpoint pattern:

- Stable lookup-ish endpoints cache: properties, rooms, channels, external accounts, occupancy short cache.
- Volatile operational data no-store: reservations, maintenance, guest requests, guests.

### 4.4 Async error wrapping

[asyncHandler](../../backend/src/index.ts#L120-L124) wraps route promises and forwards errors to final error middleware.

---

## 5. Persistence Foundation: Prisma Schema

Prisma datasource/provider:

- `provider = "postgresql"` in [schema.prisma#L9-L12](../../backend/prisma/schema.prisma#L9-L12)
- `DATABASE_URL` env var used.

### 5.1 Operational core

| Model | Lines | Purpose |
|---|---|---|
| `properties` | [schema.prisma#L14-L28](../../backend/prisma/schema.prisma#L14-L28) | Portfolio branches/properties; parent for rooms, guests, requests, maintenance, reservations. |
| `rooms` | [schema.prisma#L30-L51](../../backend/prisma/schema.prisma#L30-L51) | Physical inventory; unique `(id, property_id)` supports compound relation from reservations. |
| `guests` | [schema.prisma#L53-L73](../../backend/prisma/schema.prisma#L53-L73) | Legacy compatibility guest surface, not authoritative booking source. |
| `guest_requests` | [schema.prisma#L75-L94](../../backend/prisma/schema.prisma#L75-L94) | Operational guest request queue, optionally tied to reservation/property. |
| `maintenance_issues` | [schema.prisma#L96-L111](../../backend/prisma/schema.prisma#L96-L111) | Room/property maintenance queue. |

### 5.2 Provider edge

| Model | Lines | Purpose |
|---|---|---|
| `channels` | [schema.prisma#L113-L124](../../backend/prisma/schema.prisma#L113-L124) | Provider registry, e.g. Airbnb. |
| `external_accounts` | [schema.prisma#L126-L149](../../backend/prisma/schema.prisma#L126-L149) | Provider accounts under a channel; unique `(channel_id, account_key)`. |
| `channel_listings` | [schema.prisma#L151-L177](../../backend/prisma/schema.prisma#L151-L177) | Provider listing identity; unique `(external_account_id, provider_listing_id)`. |
| `channel_listing_aliases` | [schema.prisma#L179-L196](../../backend/prisma/schema.prisma#L179-L196) | Alternate listing names/titles for cross-account matching. |
| `listing_room_mappings` | [schema.prisma#L198-L214](../../backend/prisma/schema.prisma#L198-L214) | Maps provider listing to physical room(s). |

### 5.3 Reservation core

| Model | Lines | Purpose |
|---|---|---|
| `reservations` | [schema.prisma#L216-L249](../../backend/prisma/schema.prisma#L216-L249) | Booking source of truth. |
| `reservation_external_refs` | [schema.prisma#L251-L278](../../backend/prisma/schema.prisma#L251-L278) | Provider reservation identity, confirmation codes, raw/source status. |
| `reservation_room_allocations` | [schema.prisma#L280-L295](../../backend/prisma/schema.prisma#L280-L295) | Multi-room allocation table; unique `(reservation_id, room_id)`. |

### 5.4 Import/reconciliation

| Model | Lines | Purpose |
|---|---|---|
| `legacy_guest_reservation_backfills` | [schema.prisma#L297-L313](../../backend/prisma/schema.prisma#L297-L313) | Bridge between legacy guest rows and reservations. |
| `provider_reservation_import_rows` | [schema.prisma#L315-L354](../../backend/prisma/schema.prisma#L315-L354) | Staging/reconciliation table for provider import rows. **Defined but not written by current ingest services.** |
| `sync_runs` | [schema.prisma#L356-L373](../../backend/prisma/schema.prisma#L356-L373) | Import run audit trail/counts/status. |
| `sync_dead_letters` | [schema.prisma#L375-L389](../../backend/prisma/schema.prisma#L375-L389) | Failed import rows with reason and normalized payload. |

---

## 6. Migration + Azure Safety

Migration guard lives in [backend/scripts/verify-azure-migration.mjs](../../backend/scripts/verify-azure-migration.mjs).

| Check | Evidence | Meaning |
|---|---|---|
| Migration dir exists | [verify-azure-migration.mjs#L12-L15](../../backend/scripts/verify-azure-migration.mjs#L12-L15) | Checks `backend/prisma/migrations`. |
| Banned Supabase roles/RLS | [verify-azure-migration.mjs#L16-L21](../../backend/scripts/verify-azure-migration.mjs#L16-L21) | Rejects `TO anon`, `TO authenticated`, `TO service_role`, `ENABLE ROW LEVEL SECURITY`. |
| Required Azure-safe primitives | [verify-azure-migration.mjs#L23-L26](../../backend/scripts/verify-azure-migration.mjs#L23-L26) | Requires `pgcrypto` and `set_updated_at_timestamp`. |
| Migration SQL loading | [verify-azure-migration.mjs#L45-L66](../../backend/scripts/verify-azure-migration.mjs#L45-L66) | Reads all migration SQL directories. |
| Table creation check | [verify-azure-migration.mjs#L88-L93](../../backend/scripts/verify-azure-migration.mjs#L88-L93) | Ensures at least one `CREATE TABLE`. |

Initial migration evidence from Oracle/subagent review:

- `pgcrypto` extension and trigger function exist in `20260502000000_init_track_b/migration.sql`.
- Later migration `20260504122217_add_sync_metadata` adds `sync_runs` and `sync_dead_letters`.
- Later migration `20260520000000_add_api_performance_indexes` adds API-oriented performance indexes.

---

## 7. Ingestion System

### 7.1 Ingest contracts

[backend/src/ingest/contracts.ts](../../backend/src/ingest/contracts.ts) defines runtime contract primitives:

| Contract | Lines | Meaning |
|---|---|---|
| Ingest kinds | [contracts.ts#L1-L2](../../backend/src/ingest/contracts.ts#L1-L2) | `listings`, `reservations`, `google-sheets`. |
| Source types | [contracts.ts#L4-L5](../../backend/src/ingest/contracts.ts#L4-L5) | `json`, `multipart`, `google-sheets`. |
| Source accounts | [contracts.ts#L7-L8](../../backend/src/ingest/contracts.ts#L7-L8) | `airbnb-main`, `airbnb-ruby`, `airbnb-manuka22`. |
| Error codes | [contracts.ts#L10-L18](../../backend/src/ingest/contracts.ts#L10-L18) | Includes malformed file, unsupported source, unresolved listing, ambiguous match, config/auth failure. |
| File contract | [contracts.ts#L20-L29](../../backend/src/ingest/contracts.ts#L20-L29) | 10MB max; CSV/JSON/XLS/XLSX MIME types. |
| Summary response | [contracts.ts#L37-L46](../../backend/src/ingest/contracts.ts#L37-L46) | Returns `syncRunId`, dry-run flag, processed/created/updated/skipped/dead-letter counts, errors. |
| Empty summary helper | [contracts.ts#L83-L98](../../backend/src/ingest/contracts.ts#L83-L98) | Creates dry-run-style summary ID and zero counts. |

### 7.2 Route validation + upload handling

[backend/src/ingest/routes.ts](../../backend/src/ingest/routes.ts):

| Concern | Lines | Behavior |
|---|---|---|
| Multer memory upload | [routes.ts#L14-L17](../../backend/src/ingest/routes.ts#L14-L17) | Uses `memoryStorage`, capped by contract max file size. |
| Object/body guards | [routes.ts#L19-L30](../../backend/src/ingest/routes.ts#L19-L30) | Validates request body shape and string fields. |
| `dryRun` validation | [routes.ts#L32-L44](../../backend/src/ingest/routes.ts#L32-L44) | Requires true/false boolean or string. |
| `sourceAccount` validation | [routes.ts#L46-L59](../../backend/src/ingest/routes.ts#L46-L59) | Must be one of hardcoded accounts. |
| `sourceType` validation | [routes.ts#L61-L85](../../backend/src/ingest/routes.ts#L61-L85) | Optional except Google Sheets expected type. |
| File declaration validation | [routes.ts#L87-L117](../../backend/src/ingest/routes.ts#L87-L117) | Checks MIME and size. |
| Google Sheets validation | [routes.ts#L119-L141](../../backend/src/ingest/routes.ts#L119-L141) | Requires `spreadsheetId`; `targetKind` must be listings/reservations. |
| Combined validation | [routes.ts#L143-L154](../../backend/src/ingest/routes.ts#L143-L154) | Aggregates all validation errors. |
| Multipart parser | [routes.ts#L178-L192](../../backend/src/ingest/routes.ts#L178-L192) | Only invokes multer when `multipart/form-data`. |

### 7.3 File parsing + normalization

[backend/src/ingest/normalizer.ts](../../backend/src/ingest/normalizer.ts):

| Function | Lines | Behavior |
|---|---|---|
| `normalizeString` | [normalizer.ts#L29-L33](../../backend/src/ingest/normalizer.ts#L29-L33) | Removes BOM, trims whitespace, normalizes Unicode NFC. |
| `normalizeDateValue` | [normalizer.ts#L70-L100](../../backend/src/ingest/normalizer.ts#L70-L100) | Handles null/empty, Excel serial, numeric string serial, ISO date, `DD/MM/YYYY`. |
| `parseSourceFile` | [normalizer.ts#L102-L111](../../backend/src/ingest/normalizer.ts#L102-L111) | Uses `xlsx.read` and first sheet; converts to JSON rows. |
| `extractListings` | [normalizer.ts#L113-L130](../../backend/src/ingest/normalizer.ts#L113-L130) | Maps title/name, internal name, listing ID, location/city, source row number, raw payload. |
| `extractReservations` | [normalizer.ts#L132-L162](../../backend/src/ingest/normalizer.ts#L132-L162) | Maps confirmation/reservation IDs, guest fields, status, dates, counts, listing title. |

### 7.4 Internal-name parser

[backend/src/ingest/parser.ts](../../backend/src/ingest/parser.ts):

| Behavior | Lines | Notes |
|---|---|---|
| Known prefixes | [parser.ts#L12](../../backend/src/ingest/parser.ts#L12) | `LL`, `TheO`, `MH`, `CC`, `TC`, `23`, `TA`, `Ruby`. |
| Empty internal-name rejection | [parser.ts#L14-L20](../../backend/src/ingest/parser.ts#L14-L20) | Returns `EMPTY_INTERNAL_NAME`. |
| Prefix regex | [parser.ts#L22-L34](../../backend/src/ingest/parser.ts#L22-L34) | Extracts known prefix and trailing room part. |
| Room normalization | [parser.ts#L47-L53](../../backend/src/ingest/parser.ts#L47-L53) | Normalizes `B 9.08` → `B9.08`. |
| Composite room rejection | [parser.ts#L54-L63](../../backend/src/ingest/parser.ts#L54-L63) | Rejects `&` or ` and ` composite rooms. |
| Slug mapping | [parser.ts#L83-L96](../../backend/src/ingest/parser.ts#L83-L96) | Maps prefix to deterministic property slug. |

### 7.5 Listings sync flow

[backend/src/ingest/services/listings.ts](../../backend/src/ingest/services/listings.ts):

1. Creates separate `PrismaClient` at [listings.ts#L6](../../backend/src/ingest/services/listings.ts#L6).
2. `processListingSync` signature at [listings.ts#L8-L13](../../backend/src/ingest/services/listings.ts#L8-L13).
3. Parses source file with `parseSourceFile` at [listings.ts#L17-L25](../../backend/src/ingest/services/listings.ts#L17-L25).
4. Extracts listings and sets processed count at [listings.ts#L27-L28](../../backend/src/ingest/services/listings.ts#L27-L28).
5. Creates `sync_runs` for real runs at [listings.ts#L30-L43](../../backend/src/ingest/services/listings.ts#L30-L43).
6. Upserts `channels` slug `airbnb` and `external_accounts` by `(channel_id, account_key)` at [listings.ts#L45-L75](../../backend/src/ingest/services/listings.ts#L45-L75).
7. Per listing, parses internal name at [listings.ts#L79-L81](../../backend/src/ingest/services/listings.ts#L79-L81).
8. Parser failures become dead letters at [listings.ts#L82-L91](../../backend/src/ingest/services/listings.ts#L82-L91).
9. Provider-ID path uses per-row Prisma transaction at [listings.ts#L94-L181](../../backend/src/ingest/services/listings.ts#L94-L181):
   - Upserts property by slug.
   - Finds/creates room.
   - Upserts channel listing by `(external_account_id, provider_listing_id)`.
   - Creates listing-room mapping if absent.
10. Title-only path handles Ruby/Manuka-style matching at [listings.ts#L181-L224](../../backend/src/ingest/services/listings.ts#L181-L224):
    - 0 matches → `UNRESOLVED_LISTING` dead letter.
    - 1 match → upserts alias.
    - multiple matches → `AMBIGUOUS_LISTING_MATCH` dead letter.
11. Writes dead letters after loop at [listings.ts#L242-L246](../../backend/src/ingest/services/listings.ts#L242-L246).
12. Updates sync run as `completed` with counts at [listings.ts#L248-L261](../../backend/src/ingest/services/listings.ts#L248-L261).

### 7.6 Reservations sync flow

[backend/src/ingest/services/reservations.ts](../../backend/src/ingest/services/reservations.ts):

1. Creates separate `PrismaClient` at [reservations.ts#L5](../../backend/src/ingest/services/reservations.ts#L5).
2. `toValidDate` validates parsed dates at [reservations.ts#L7-L14](../../backend/src/ingest/services/reservations.ts#L7-L14).
3. Operational note string is built at [reservations.ts#L16-L18](../../backend/src/ingest/services/reservations.ts#L16-L18).
4. `processReservationSync` signature at [reservations.ts#L20-L25](../../backend/src/ingest/services/reservations.ts#L20-L25).
5. Parses/extracts reservation rows at [reservations.ts#L29-L40](../../backend/src/ingest/services/reservations.ts#L29-L40).
6. Creates sync run at [reservations.ts#L42-L54](../../backend/src/ingest/services/reservations.ts#L42-L54).
7. Upserts channel/account at [reservations.ts#L56-L82](../../backend/src/ingest/services/reservations.ts#L56-L82).
8. Per row transaction starts at [reservations.ts#L86-L90](../../backend/src/ingest/services/reservations.ts#L86-L90).
9. Listing resolution path:
   - Alias match by `external_account_id + alias_value` at [reservations.ts#L95-L119](../../backend/src/ingest/services/reservations.ts#L95-L119).
   - Exact listing title fallback at [reservations.ts#L120-L140](../../backend/src/ingest/services/reservations.ts#L120-L140).
   - Failure dead letter at [reservations.ts#L143-L153](../../backend/src/ingest/services/reservations.ts#L143-L153).
10. Confirmation code required at [reservations.ts#L155-L165](../../backend/src/ingest/services/reservations.ts#L155-L165).
11. Check-in/out date validation at [reservations.ts#L167-L179](../../backend/src/ingest/services/reservations.ts#L167-L179).
12. Existing reservation lookup uses `reservation_external_refs.findFirst` by channel/account/confirmation code at [reservations.ts#L183-L190](../../backend/src/ingest/services/reservations.ts#L183-L190).
13. Status normalization at [reservations.ts#L192-L198](../../backend/src/ingest/services/reservations.ts#L192-L198):
    - `currently hosting`, `arriving today`, `ongoing` → `checked_in`
    - `confirmed`, `upcoming` → `pending`
    - `review guest`, `past guest`, `checkout today` → `checked_out`
    - `canceled`, `cancelled` → `cancelled`
14. Existing path updates reservation, external ref, room allocation at [reservations.ts#L202-L256](../../backend/src/ingest/services/reservations.ts#L202-L256).
15. Create path inserts reservation, external ref, room allocation at [reservations.ts#L257-L300](../../backend/src/ingest/services/reservations.ts#L257-L300).
16. Writes dead letters after loop at [reservations.ts#L314-L318](../../backend/src/ingest/services/reservations.ts#L314-L318).
17. Updates sync run as `completed` at [reservations.ts#L320-L333](../../backend/src/ingest/services/reservations.ts#L320-L333).

### 7.7 Google Sheets sync flow

[backend/src/ingest/services/sheets.ts](../../backend/src/ingest/services/sheets.ts):

| Step | Lines | Behavior |
|---|---|---|
| Credential path resolution | [sheets.ts#L9-L18](../../backend/src/ingest/services/sheets.ts#L9-L18) | Uses `GOOGLE_SERVICE_ACCOUNT_FILE` or `GOOGLE_APPLICATION_CREDENTIALS`; resolves relative paths from cwd. |
| Credential existence check | [sheets.ts#L20-L26](../../backend/src/ingest/services/sheets.ts#L20-L26) | Uses `fs.existsSync`. |
| Google auth | [sheets.ts#L34-L37](../../backend/src/ingest/services/sheets.ts#L34-L37) | Service-account auth with `spreadsheets.readonly` scope. |
| Sheet metadata fallback | [sheets.ts#L41-L54](../../backend/src/ingest/services/sheets.ts#L41-L54) | If no sheet name, uses first sheet. |
| Range fetch | [sheets.ts#L56-L66](../../backend/src/ingest/services/sheets.ts#L56-L66) | Fetches `${selectedSheetName}!A:ZZ`. |
| CSV conversion | [sheets.ts#L69-L73](../../backend/src/ingest/services/sheets.ts#L69-L73) | Converts AOA to sheet, then CSV, then Buffer. |
| Delegation | [sheets.ts#L75-L111](../../backend/src/ingest/services/sheets.ts#L75-L111) | Delegates to listing or reservation sync service. |

---

## 8. End-to-End Data Flows

### 8.1 Frontend → REST backend flow

[src/lib/repositories/rest-repositories.ts](../../src/lib/repositories/rest-repositories.ts):

- Base API URL: `VITE_TRACK_B_API_URL ?? "http://localhost:3001"` at [rest-repositories.ts#L21-L24](../../src/lib/repositories/rest-repositories.ts#L21-L24).
- Fetch wrapper throws on non-2xx at [rest-repositories.ts#L42-L48](../../src/lib/repositories/rest-repositories.ts#L42-L48).
- Repositories call matching Express endpoints:
  - Properties: [rest-repositories.ts#L50-L59](../../src/lib/repositories/rest-repositories.ts#L50-L59)
  - Rooms: [rest-repositories.ts#L61-L73](../../src/lib/repositories/rest-repositories.ts#L61-L73)
  - Reservations: [rest-repositories.ts#L75-L100](../../src/lib/repositories/rest-repositories.ts#L75-L100)
  - Guest requests: [rest-repositories.ts#L102-L114](../../src/lib/repositories/rest-repositories.ts#L102-L114)
  - Maintenance: [rest-repositories.ts#L116-L131](../../src/lib/repositories/rest-repositories.ts#L116-L131)
  - Stats: [rest-repositories.ts#L133-L143](../../src/lib/repositories/rest-repositories.ts#L133-L143)
  - Factory: [rest-repositories.ts#L145-L153](../../src/lib/repositories/rest-repositories.ts#L145-L153)

[src/hooks/use-dashboard-data.ts](../../src/hooks/use-dashboard-data.ts):

- Uses `createRestRepositories()` directly at [use-dashboard-data.ts#L109-L110](../../src/hooks/use-dashboard-data.ts#L109-L110).
- Loads dashboard data through TanStack Query at [use-dashboard-data.ts#L111-L142](../../src/hooks/use-dashboard-data.ts#L111-L142).
- Converts reservations into guest-shaped dashboard compatibility objects at [use-dashboard-data.ts#L65-L80](../../src/hooks/use-dashboard-data.ts#L65-L80).

[vite.config.ts](../../vite.config.ts):

- Dev proxy maps `/api` to `http://localhost:3001` at [vite.config.ts#L14-L23](../../vite.config.ts#L14-L23).

### 8.2 Listing ingest data flow

```text
POST /api/ingest/listings
  → routes.validateIngestRequest()
  → multer memory file buffer
  → processListingSync(buffer, mimeType, sourceAccount, dryRun)
  → parseSourceFile()
  → extractListings()
  → parseInternalName()
  → channel/external_account upsert
  → property upsert
  → room find/create
  → channel_listing upsert OR title-only alias matching
  → listing_room_mappings create
  → sync_dead_letters for bad rows
  → sync_runs counts/status update
```

### 8.3 Reservation ingest data flow

```text
POST /api/ingest/reservations
  → routes.validateIngestRequest()
  → multer memory file buffer
  → processReservationSync(buffer, mimeType, sourceAccount, dryRun)
  → parseSourceFile()
  → extractReservations()
  → channel/external_account upsert
  → resolve listing via alias OR exact listing title
  → resolve first mapped room + property
  → find existing reservation_external_ref by channel/account/confirmation_code
  → update or create reservation
  → update or create reservation_external_ref
  → update or create reservation_room_allocation
  → sync_dead_letters for bad rows
  → sync_runs counts/status update
```

### 8.4 Google Sheets ingest data flow

```text
POST /api/ingest/google-sheets
  → validate spreadsheetId + targetKind
  → service account credentials
  → Google Sheets API values.get(A:ZZ)
  → convert values to CSV buffer
  → processListingSync OR processReservationSync
```

---

## 9. Verification + Operational Scripts

### 9.1 Ingestion verification harness

[backend/scripts/verify-ingestion.ts](../../backend/scripts/verify-ingestion.ts):

| Area | Lines | Behavior |
|---|---|---|
| Prisma + port config | [verify-ingestion.ts#L4-L10](../../backend/scripts/verify-ingestion.ts#L4-L10) | Creates Prisma client; picks random verification port; supports `GOOGLE_SHEETS_SPREADSHEET_ID`. |
| Multipart test helper | [verify-ingestion.ts#L23-L53](../../backend/scripts/verify-ingestion.ts#L23-L53) | Posts form-data file to `/api/ingest/*`, asserts expected status. |
| Server readiness | [verify-ingestion.ts#L55-L72](../../backend/scripts/verify-ingestion.ts#L55-L72) | Polls `/health`. |
| DB state check | [verify-ingestion.ts#L74-L87](../../backend/scripts/verify-ingestion.ts#L74-L87) | Counts sync runs, dead letters, listings, reservations. |
| Server spawn | [verify-ingestion.ts#L89-L107](../../backend/scripts/verify-ingestion.ts#L89-L107) | Spawns `tsx src/index.ts` on random port. |
| Dry-run no mutation | [verify-ingestion.ts#L111-L119](../../backend/scripts/verify-ingestion.ts#L111-L119) | Ensures dry run does not mutate business tables. |
| Happy/idempotent/ambiguous/malformed/listing tests | [verify-ingestion.ts#L121-L144](../../backend/scripts/verify-ingestion.ts#L121-L144) | Exercises listing ingest cases. |
| Reservation ingest test | [verify-ingestion.ts#L145-L153](../../backend/scripts/verify-ingestion.ts#L145-L153) | Expects 4 processed, 2 dead letters, at least 2 created+updated. |
| Google Sheets contract test | [verify-ingestion.ts#L155-L181](../../backend/scripts/verify-ingestion.ts#L155-L181) | Tests real Sheets if env set; else expects structured error. |
| Final DB assertions | [verify-ingestion.ts#L183-L197](../../backend/scripts/verify-ingestion.ts#L183-L197) | Expects 3 persisted test listings and 2 reservation refs. |
| Cleanup | [verify-ingestion.ts#L202-L208](../../backend/scripts/verify-ingestion.ts#L202-L208) | Disconnects Prisma and kills server. |

### 9.2 Offline listing classification

[backend/scripts/classify-airbnb-listings.ts](../../backend/scripts/classify-airbnb-listings.ts):

- Reads `database_design/Mujo.csv`, `Ruby.csv`, `Manuka.csv` at [classify-airbnb-listings.ts#L220-L229](../../backend/scripts/classify-airbnb-listings.ts#L220-L229).
- Classifies listing visibility tiers based on account hierarchy at [classify-airbnb-listings.ts#L174-L214](../../backend/scripts/classify-airbnb-listings.ts#L174-L214).
- Validates hierarchy subset relationships at [classify-airbnb-listings.ts#L243-L248](../../backend/scripts/classify-airbnb-listings.ts#L243-L248).
- This is offline tooling; no Express route calls it.

---

## 10. Risks, Gaps, Unknowns

### 10.1 Security risks

| Risk | Evidence | Impact |
|---|---|---|
| No backend auth middleware observed | Middleware stack before routes is CORS/compression/json/ingest only in [index.ts#L37-L52](../../backend/src/index.ts#L37-L52) | Backend unsafe for untrusted direct exposure without upstream auth/network controls. |
| Write-capable ingest endpoints unauthenticated | Routes accept `dryRun=false` and dispatch services at [routes.ts#L195-L270](../../backend/src/ingest/routes.ts#L195-L270) | Anyone reaching backend can mutate listings/reservations if no external protection exists. |
| Room passcodes exposed | `/api/rooms` selects `passcode` at [index.ts#L373-L383](../../backend/src/index.ts#L373-L383) | Sensitive room access data returned by read API. |

### 10.2 Data integrity risks

| Risk | Evidence | Impact |
|---|---|---|
| Reservation idempotency not DB-enforced by unique constraint | `reservation_external_refs` has indexes, not unique constraints, at [schema.prisma#L274-L278](../../backend/prisma/schema.prisma#L274-L278); import uses `findFirst` at [reservations.ts#L183-L190](../../backend/src/ingest/services/reservations.ts#L183-L190) | Concurrent imports can create duplicates for same provider confirmation code. |
| `provider_reservation_import_rows` unused by current ingest | Model exists at [schema.prisma#L315-L354](../../backend/prisma/schema.prisma#L315-L354), but services write reservations/ref/allocation directly | Staging/reconciliation model appears deferred or disconnected from current flow. |
| Multi-room listing collapsed to first mapping | Reservation resolution reads first mapping at [reservations.ts#L113-L118](../../backend/src/ingest/services/reservations.ts#L113-L118) and [reservations.ts#L133-L138](../../backend/src/ingest/services/reservations.ts#L133-L138) | Schema supports multi-room allocation, but import path chooses one room. |
| Unknown raw statuses default to pending | `normalizedStatus` initialized to `pending` before hardcoded mappings at [reservations.ts#L192-L198](../../backend/src/ingest/services/reservations.ts#L192-L198) | Provider status vocabulary drift can silently become pending. |
| Domain states stored as strings | Reservation/room/maintenance status fields are plain strings in [schema.prisma#L36](../../backend/prisma/schema.prisma#L36), [schema.prisma#L102-L103](../../backend/prisma/schema.prisma#L102-L103), [schema.prisma#L220](../../backend/prisma/schema.prisma#L220) | DB does not enforce enum-like invariants. |

### 10.3 Operational risks

| Risk | Evidence | Impact |
|---|---|---|
| Multiple Prisma clients | App client at [index.ts#L15](../../backend/src/index.ts#L15), listing client at [listings.ts#L6](../../backend/src/ingest/services/listings.ts#L6), reservation client at [reservations.ts#L5](../../backend/src/ingest/services/reservations.ts#L5) | More DB connections under concurrent API + ingest traffic. |
| In-memory occupancy computation | Loads properties/rooms/reservations and loops in memory at [index.ts#L256-L345](../../backend/src/index.ts#L256-L345) | OK for current scale, likely first analytics endpoint needing DB aggregation later. |
| In-memory file uploads/parsing | Multer memory storage at [routes.ts#L14-L17](../../backend/src/ingest/routes.ts#L14-L17), full workbook parse at [normalizer.ts#L102-L111](../../backend/src/ingest/normalizer.ts#L102-L111) | 10MB cap helps, but XLSX CPU/memory can still spike. |
| Sync run completion semantics | Services mark runs `completed` even when row errors/dead letters exist at [listings.ts#L248-L261](../../backend/src/ingest/services/listings.ts#L248-L261), [reservations.ts#L320-L333](../../backend/src/ingest/services/reservations.ts#L320-L333) | Operators must inspect counts/errors; status alone is not enough. |

### 10.4 Contract/API mismatch risks

| Risk | Evidence | Impact |
|---|---|---|
| Ingest TypeScript contract suggests dry-run-only request types, runtime allows real writes | Contract `BaseIngestJsonRequest` has `dryRun: true` at [contracts.ts#L48-L56](../../backend/src/ingest/contracts.ts#L48-L56), multipart has `dryRun: "true"` at [contracts.ts#L58-L68](../../backend/src/ingest/contracts.ts#L58-L68), while route validation accepts false at [routes.ts#L32-L44](../../backend/src/ingest/routes.ts#L32-L44) | Contract may be stale or intentionally conservative; generated/API docs could mislead callers. |
| Frontend repository assumes some endpoints not implemented | `getById` calls `/api/properties/:id`, `/api/rooms/:id`, `/api/guest-requests/:id`, `/api/maintenance/:id` in [rest-repositories.ts#L55-L58](../../src/lib/repositories/rest-repositories.ts#L55-L58), [rest-repositories.ts#L66-L69](../../src/lib/repositories/rest-repositories.ts#L66-L69), [rest-repositories.ts#L107-L110](../../src/lib/repositories/rest-repositories.ts#L107-L110), [rest-repositories.ts#L121-L124](../../src/lib/repositories/rest-repositories.ts#L121-L124); backend only implements reservation by ID | Current dashboard may not hit these methods, but repository contract has partial backend support. |

---

## 11. External Norms Context

External reference agent notes:

- Express middleware/route stacks are conventional via `app.use()` and `app.METHOD()`; error middleware should be last. Official docs: <https://expressjs.com/en/guide/using-middleware.html>, <https://expressjs.com/en/guide/routing.html>, <https://expressjs.com/en/guide/error-handling.html>
- Prisma migration history should be committed as source of truth (`schema.prisma` + migrations). Official docs: <https://www.prisma.io/docs/orm/v6/prisma-migrate/understanding-prisma-migrate/migration-histories>
- For large ingestion, Node streams recommend `stream.pipeline()` and backpressure handling. Official docs: <https://nodejs.org/api/stream.html>, <https://nodejs.org/en/learn/modules/how-to-use-streams>

Source-backed implication for this repo:

- Current route organization is acceptable for scaffold, but write APIs and growth would benefit from route/service split like ingestion already uses.
- Current ingestion uses memory buffering, acceptable under 10MB cap but not streaming/backpressure-based.

---

## 12. Summary Table

| Area | Primary files | Key finding |
|---|---|---|
| Runtime | [backend/src/index.ts](../../backend/src/index.ts) | Single Express app with CORS, compression, JSON body parser, direct Prisma route handlers. |
| Database | [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma) | PostgreSQL via Prisma; reservations are booking source of truth; guests are legacy compatibility. |
| API | [backend/src/index.ts](../../backend/src/index.ts) | Read-only dashboard APIs plus occupancy stats; direct Prisma query construction in route handlers. |
| Ingestion | [backend/src/ingest/routes.ts](../../backend/src/ingest/routes.ts), [backend/src/ingest/services](../../backend/src/ingest/services) | Write/import subsystem supports listings, reservations, Google Sheets. |
| Provider model | [schema.prisma#L113-L214](../../backend/prisma/schema.prisma#L113-L214) | Channels/accounts/listings/aliases/mappings model provider boundary. |
| Reservation model | [schema.prisma#L216-L295](../../backend/prisma/schema.prisma#L216-L295) | Reservations, external refs, room allocations form core booking path. |
| Observability | [schema.prisma#L356-L389](../../backend/prisma/schema.prisma#L356-L389) | `sync_runs` and `sync_dead_letters` provide ingest audit trail. |
| Verification | [backend/scripts/verify-ingestion.ts](../../backend/scripts/verify-ingestion.ts), [backend/scripts/verify-azure-migration.mjs](../../backend/scripts/verify-azure-migration.mjs) | Has migration guard and live ingestion verification harness. |
| Frontend boundary | [src/lib/repositories/rest-repositories.ts](../../src/lib/repositories/rest-repositories.ts) | REST adapter points frontend at Track B Express backend. |
| Highest risk | [backend/src/index.ts#L380](../../backend/src/index.ts#L380), [backend/src/ingest/routes.ts#L195-L270](../../backend/src/ingest/routes.ts#L195-L270) | Room passcode exposure and unauthenticated ingest write endpoints are biggest deployment blockers. |

---

## 13. Command To Enforce/Recreate This Markdown File

Run from repo root in PowerShell 7+:

```powershell
$path = "docs/analysis/TRACK_B_BACKEND_ANALYSIS.md"; if (!(Test-Path -LiteralPath "docs/analysis")) { throw "Missing docs/analysis directory" }; if (!(Test-Path -LiteralPath $path)) { throw "Missing $path" }; Get-Item -LiteralPath $path | Format-List FullName,Length,LastWriteTime
```

This command enforces presence of report file and fails if expected directory or file is missing.
