# Task 1 — Canonical v1 Schema Contract and Migration Safety Boundaries

## 1. Scope and goals

This artifact locks the additive **v1 balanced-core schema contract** that downstream Tasks 2-8 must implement. It exists because Task 0 established that the current repo is **dashboard-sufficient but PMS-insufficient** and that Sprint 1 cannot proceed safely without an explicit reservation-first contract (`.sisyphus/evidence/task-0-gap-audit.md:83-90`, `:141-159`).

This contract is intentionally limited to:

- the exact v1 table inventory required by the plan (`.sisyphus/plans/airbnb-postgres-schema.md:54-58`)
- additive migration boundaries required by the current Supabase runtime (`supabase/migrations/AGENTS.md:13-18`)
- compatibility with the current frontend schema and dashboard semantics (`src/types/database.ts:1-84`; `src/hooks/use-dashboard-data.ts:38-50`, `:57-92`)

This contract explicitly does **not** implement SQL yet. It defines what later migrations must and must not do.

## 2. Inputs reviewed

| Input | Why it governs this contract |
|---|---|
| `.sisyphus/evidence/task-0-gap-audit.md:53-61`, `:91-105`, `:141-159` | Establishes reusable vs under-modeled vs missing schema pieces and identifies `reservations` + provider-edge tables as the missing foundation. |
| `.sisyphus/evidence/task-0-gap-audit-error.md:9-23` | Rejects false assumptions that current `guests` already equals reservations/CRM/idempotency. |
| `.sisyphus/plans/airbnb-postgres-schema.md:24-29`, `:33-38`, `:54-58`, `:70-88`, `:178-215` | Provides the canonical v1 inventory, additive-only rules, and Task 1 acceptance criteria. |
| `supabase/migrations/20260409044835_create_portfolio_schema.sql:62-152` | Defines the current live table and column contract that must survive initial cutover. |
| `supabase/migrations/AGENTS.md:13-30` | Requires additive migrations, RLS review, and reconciliation with the frontend hook/types. |
| `src/types/database.ts:1-84` | Defines the current status vocabularies and frontend table expectations. |
| `src/hooks/use-dashboard-data.ts:38-50`, `:57-92` | Shows the runtime still reads exactly five tables and derives arrivals/departures from `guests.check_in_status`. |
| `database_design/db-schema-airbnb.md:46-73` | Contributes the listing/mapping idea, but not its `brands` or provider-leaky design. |

## 3. Canonical v1 table inventory

The v1 inventory is fixed by plan and refined here into exact roles.

### 3.1 Core operational tables

| Table | Class | Purpose | Primary key | Required foreign keys | Contract notes |
|---|---|---|---|---|---|
| `properties` | core | Canonical property/branch inventory for the operating portfolio. | `id uuid` | none | Retained in place. No provider-specific identity columns may be added in v1. Current `status` remains the property activation vocabulary (`supabase/migrations/20260409044835_create_portfolio_schema.sql:62-70`). |
| `rooms` | core | Canonical physical room/unit inventory owned by a property. | `id uuid` | `property_id -> properties.id` | Retained in place. Remains the durable physical inventory table. No channel/listing IDs on this table in v1 (`supabase/migrations/20260409044835_create_portfolio_schema.sql:79-89`). |
| `maintenance_issues` | core | Operational maintenance queue anchored to properties and optionally rooms. | `id uuid` | `property_id -> properties.id`; `room_id -> rooms.id` nullable | Retained in place. No reservation dependency is required for v1 (`supabase/migrations/20260409044835_create_portfolio_schema.sql:136-145`). |
| `reservations` | core | New authoritative booking/reservation record for operational use, ingestion, and later frontend migration. | `id uuid` | `property_id -> properties.id` required; no required `room_id` column on the table itself | New core. Reservation-to-room assignment is modeled through `reservation_room_allocations`, not a single durable `room_id`, because composite listings and multi-room mappings are required by plan (`.sisyphus/plans/airbnb-postgres-schema.md:35-37`). |
| `reservation_room_allocations` | core | Join table allocating one reservation to one or more internal rooms. | `id uuid` **or** composite unique key anchored by `reservation_id + room_id` | `reservation_id -> reservations.id`; `room_id -> rooms.id` | New core. Must support one reservation mapping to multiple rooms, while preventing duplicate room allocation rows for the same reservation. |

### 3.2 Provider-edge tables

| Table | Class | Purpose | Primary key | Required foreign keys | Contract notes |
|---|---|---|---|---|---|
| `channels` | provider edge | Registry of supported distribution providers/channels. | `id uuid` | none | New edge. Seed with `airbnb` first, but keep naming/provider model channel-agnostic. |
| `external_accounts` | provider edge | Provider account ownership boundary (three Airbnb accounts today). | `id uuid` | `channel_id -> channels.id` | New edge. Accounts are not equivalent to properties. Account identity uniqueness is scoped to channel, not globally. |
| `channel_listings` | provider edge | Durable provider listing identity and listing-level sync metadata. | `id uuid` | `external_account_id -> external_accounts.id` | New edge. The durable external identity lives here; listing title/internal name are descriptive only, never a durable key. |
| `channel_listing_aliases` | provider edge | Alternate/non-durable titles, internal labels, and other import-time matching handles for a listing. | `id uuid` | `channel_listing_id -> channel_listings.id` | New edge. This is the approved home for title/internal-name matching aids so they do not become primary keys. |
| `listing_room_mappings` | provider edge | Mapping from one provider listing to one or more internal rooms. | `id uuid` **or** composite unique key anchored by `channel_listing_id + room_id` | `channel_listing_id -> channel_listings.id`; `room_id -> rooms.id` | New edge. Supports simple and composite listings without leaking listing identity onto `rooms`. |
| `reservation_external_refs` | provider edge | Provider-specific reservation identities, raw statuses, and source sync metadata for a core reservation. | `id uuid` | `reservation_id -> reservations.id`; `channel_id -> channels.id` required; `external_account_id -> external_accounts.id` nullable but expected when provider data exists; `channel_listing_id -> channel_listings.id` nullable | New edge. This is the canonical home for external reservation IDs, raw source state, and idempotency keys. |

### 3.3 Transitional compatibility tables

| Table | Class | Purpose | Primary key | Required foreign keys | Contract notes |
|---|---|---|---|---|---|
| `guests` | transitional compatibility | Preserve the current dashboard-facing booking-like row shape during cutover while future work separates guest identity from reservation truth. | `id uuid` | `property_id -> properties.id`; `room_id -> rooms.id` nullable | Must remain intact through the initial cutover. Task 0 proved this table is under-modeled, not authoritative reservations core (`.sisyphus/evidence/task-0-gap-audit.md:97-102`; `.sisyphus/evidence/task-0-gap-audit-error.md:9-15`). |
| `guest_requests` | transitional compatibility | Preserve current request/note workflow while later work re-anchors requests to the new reservation core safely. | `id uuid` | `guest_id -> guests.id`; `room_id -> rooms.id` | Retained intact in first migration wave. This table remains transitional because it currently hangs off `guest_id`, not a reservation core (`.sisyphus/evidence/task-0-gap-audit.md:97-99`, `:153-157`). |

## 4. Core vs provider-edge vs compatibility boundaries

### 4.1 Core boundary

Core tables represent the property's operational truth independent of channel/vendor implementation:

- physical inventory: `properties`, `rooms`
- operational issues: `maintenance_issues`
- booking truth: `reservations`, `reservation_room_allocations`

Core tables may contain:

- internal identifiers
- local stay dates
- normalized operational statuses
- property/room/reservation relationships
- operational notes that are not provider-specific

Core tables must **not** contain:

- Airbnb-specific IDs, URLs, or status strings
- source payload blobs used only for sync/idempotency
- listing title/internal-name matching keys as durable identifiers

### 4.2 Provider-edge boundary

Provider-edge tables isolate everything that is provider/account/listing/source specific:

- provider registry and accounts: `channels`, `external_accounts`
- listing identity and aliasing: `channel_listings`, `channel_listing_aliases`, `listing_room_mappings`
- reservation import/reference/sync metadata: `reservation_external_refs`

This boundary is required by the plan's guardrail against provider leakage into core tables (`.sisyphus/plans/airbnb-postgres-schema.md:33-38`, `:81-87`).

### 4.3 Transitional compatibility boundary

`guests` and `guest_requests` survive because the current frontend reads them directly (`src/hooks/use-dashboard-data.ts:38-43`) and derives daily arrivals/departures from `guests.check_in_status` (`src/hooks/use-dashboard-data.ts:70-75`).

The compatibility rule is:

1. **Do not destroy or rename these tables in the first migration wave.**
2. **Do not let these tables define the long-term booking core.**
3. **Use later migration work to backfill from `reservations` into compatibility reads until the frontend is moved.**

## 5. Relationship contract

This section defines the minimum required relationships and the anti-coupling rules for downstream migrations.

### 5.1 Required relationships

- `rooms.property_id -> properties.id`
- `maintenance_issues.property_id -> properties.id`
- `maintenance_issues.room_id -> rooms.id` (nullable)
- `guests.property_id -> properties.id`
- `guests.room_id -> rooms.id` (nullable)
- `guest_requests.guest_id -> guests.id`
- `guest_requests.room_id -> rooms.id`
- `reservations.property_id -> properties.id`
- `reservation_room_allocations.reservation_id -> reservations.id`
- `reservation_room_allocations.room_id -> rooms.id`
- `external_accounts.channel_id -> channels.id`
- `channel_listings.external_account_id -> external_accounts.id`
- `channel_listing_aliases.channel_listing_id -> channel_listings.id`
- `listing_room_mappings.channel_listing_id -> channel_listings.id`
- `listing_room_mappings.room_id -> rooms.id`
- `reservation_external_refs.reservation_id -> reservations.id`
- `reservation_external_refs.channel_id -> channels.id`
- `reservation_external_refs.external_account_id -> external_accounts.id` (nullable for edge cases, but expected for imported provider rows)
- `reservation_external_refs.channel_listing_id -> channel_listings.id` (nullable to allow unmatched imports while preserving source identity)

### 5.2 Anti-coupling rules

- `reservations` must **not** use listing titles or internal names as foreign keys or uniqueness keys.
- `reservations` must **not** embed Airbnb/account/listing identifiers directly in core columns.
- `rooms` must **not** gain provider-specific listing columns.
- `properties` must **not** gain provider-account linkage columns in v1.
- `guest_requests` must not be destructively re-pointed before compatibility strategy exists.

### 5.3 Uniqueness and identity boundaries

- `properties.slug` remains the internal property slug uniqueness boundary (`supabase/migrations/20260409044835_create_portfolio_schema.sql:62-70`).
- `channel_listings` must have a durable provider identity uniqueness rule scoped to the owning external account, not the listing title.
- `channel_listing_aliases` may duplicate values across listings/accounts over time; they are matching aids, not durable identities.
- `listing_room_mappings` must reject duplicate `(channel_listing_id, room_id)` pairs.
- `reservation_external_refs` must reject duplicate reservation external identities within the same channel/account/source identity boundary.
- `reservation_room_allocations` must reject duplicate `(reservation_id, room_id)` pairs.

## 6. Naming and time contract

### 6.1 Naming conventions

For all new v1 tables and columns:

- use snake_case table and column names
- use `id` as the primary key name
- use `<parent>_id` for foreign keys
- use `*_date` for local stay-bound fields
- use `*_at` for real instants stored as `timestamptz`
- use `status` for authoritative normalized operational state
- use `raw_*` or `source_*` names only in provider-edge tables for external/provider-specific values

Legacy exceptions that survive untouched during cutover:

- `guests.eta`
- `guests.etd`
- `guests.check_in_status`

Those legacy fields remain for compatibility only and must not be copied as the naming template for new core tables.

### 6.2 Time model

The time contract is fixed as follows:

- reservation stay bounds use **local stay dates**, not timestamps
- sync/audit/source moments use **`timestamptz`**

For new core reservation modeling this means:

- `reservations.check_in_date` is a `date`
- `reservations.check_out_date` is a `date`
- `reservation_room_allocations` may use optional date-scoped allocation fields only if later implementation needs partial-stay room splits; if omitted initially, the reservation-level stay dates remain authoritative

For new provider-edge modeling this means:

- `channel_listings.last_synced_at` is `timestamptz`
- `external_accounts.last_synced_at` is `timestamptz`
- `reservation_external_refs.source_created_at`, `source_updated_at`, and `last_synced_at` are `timestamptz`

Rationale:

- Task 0 showed the current schema stores `guests.eta`/`etd` as timestamps (`supabase/migrations/20260409044835_create_portfolio_schema.sql:98-110`), but Sprint 1 needs a stable reservation stay contract rather than provider timestamp semantics.
- The plan explicitly requires local stay dates for reservation bounds and `timestamptz` for sync/audit fields (`.sisyphus/plans/airbnb-postgres-schema.md:178-215`).

## 7. Status and constraint contract

### 7.1 Current status vocabularies that must stay compatible

Current dashboard/runtime evidence shows these existing vocabularies:

| Surface | Current vocabulary | Evidence |
|---|---|---|
| `properties.status` | `active`, `inactive` | `supabase/migrations/20260409044835_create_portfolio_schema.sql:62-70` |
| `rooms.status` | `Vacant`, `Occupied`, `Check-In Pending`, `Checked In`, `Check-Out Pending`, `Checked Out`, `Needs Attention` | `supabase/migrations/20260409044835_create_portfolio_schema.sql:79-89`; `src/types/database.ts:11-30` |
| `guests.check_in_status` | `Pending`, `Checked In`, `Check-In Pending`, `Check-Out Pending`, `Checked Out` | `supabase/migrations/20260409044835_create_portfolio_schema.sql:98-110`; `src/types/database.ts:32-51` |
| `maintenance_issues.status` | `Open`, `In Progress`, `Resolved` | `supabase/migrations/20260409044835_create_portfolio_schema.sql:136-145`; `src/types/database.ts:63-75` |
| `maintenance_issues.severity` | `Low`, `Medium`, `High`, `Critical` | `supabase/migrations/20260409044835_create_portfolio_schema.sql:136-145`; `src/types/database.ts:63-75` |

The current dashboard computes:

- arrivals from `guests.check_in_status in ('Pending', 'Check-In Pending')`
- departures from `guests.check_in_status = 'Check-Out Pending'`
- occupied rooms from `rooms.status in ('Occupied', 'Checked In', 'Check-Out Pending')`
- open maintenance from `maintenance_issues.status != 'Resolved'`

Evidence: `src/hooks/use-dashboard-data.ts:62-78`.

### 7.2 New authoritative reservation status vocabulary

The v1 `reservations` core must use a normalized authoritative status vocabulary that preserves current dashboard semantics while allowing reservation-first ingestion:

- `pending`
- `check_in_pending`
- `checked_in`
- `check_out_pending`
- `checked_out`
- `cancelled`
- `no_show`

Rules:

- this vocabulary belongs on the core `reservations.status` column
- values should be enforced by a check constraint or enum-like database constraint in the migration implementation
- current guest-status semantics map directly into the first five values
- `cancelled` and `no_show` are additive v1 core states that do not exist in the legacy dashboard contract today

### 7.3 Compatibility mapping strategy

To preserve current dashboard behavior during migration:

| Current dashboard semantic | Legacy source today | Canonical reservation source tomorrow |
|---|---|---|
| Arrivals | `guests.check_in_status in ('Pending', 'Check-In Pending')` | `reservations.status in ('pending', 'check_in_pending')` |
| Departures | `guests.check_in_status = 'Check-Out Pending'` | `reservations.status = 'check_out_pending'` |
| In-house / occupied operational signal | `rooms.status in ('Occupied', 'Checked In', 'Check-Out Pending')` | preserved initially through rooms + allocation-derived future logic |
| Completed stay | `guests.check_in_status = 'Checked Out'` | `reservations.status = 'checked_out'` |

Compatibility requirement:

- raw provider statuses must **not** become the core authoritative `reservations.status`
- raw provider statuses belong in `reservation_external_refs` (`raw_status`, `source_status`, or equivalent edge metadata fields)
- any future translation from provider raw status to core `reservations.status` must be explicit and deterministic

### 7.4 Constraint boundaries

Downstream SQL must enforce the following categories of constraint:

- status vocabularies for new v1 tables use explicit constrained values, not free-text drift
- provider identity uniqueness lives in provider-edge tables, not core tables
- room/listing/reservation join tables reject duplicate pairs
- local stay dates must remain valid reservation bounds (`check_out_date >= check_in_date`)

## 8. Migration safety rules

These rules are mandatory and non-negotiable for Tasks 2-8.

### 8.1 Anti-destruction rules

The first migration wave must **not** do any of the following:

- remove legacy runtime tables that the current frontend still queries directly
- rename legacy runtime tables before a compatibility layer exists
- remove `properties`, `rooms`, `guests`, `guest_requests`, or `maintenance_issues` from the live runtime contract
- perform destructive renames of the above tables
- perform destructive column rewrites that break `src/hooks/use-dashboard-data.ts` or `src/types/database.ts` before compatibility is in place

This follows both the plan guardrails (`.sisyphus/plans/airbnb-postgres-schema.md:35`, `:72`, `:87`) and the migration folder rule to prefer additive changes (`supabase/migrations/AGENTS.md:13-18`).

### 8.2 Guests survival rule

`guests` must remain queryable during the initial cutover because:

- the current frontend fetches it directly (`src/hooks/use-dashboard-data.ts:38-43`)
- arrivals/departures panels still depend on `guests.check_in_status` (`src/hooks/use-dashboard-data.ts:70-75`)
- Task 0 explicitly classified `guests` as under-modeled, not removable (`.sisyphus/evidence/task-0-gap-audit.md:95-102`)

Therefore the approved cutover sequence is:

1. add `reservations` and provider-edge tables
2. backfill or import reservation truth
3. maintain compatibility reads/writes for `guests`
4. migrate frontend consumers later
5. only after successful migration may a later task propose deeper `guests` refactoring

### 8.3 Provider leakage rule

Provider-specific fields must not leak into `properties`, `rooms`, or `reservations` in v1.

Examples of prohibited core patterns:

- provider listing identity stored directly on `rooms`
- provider account identity stored directly on `properties`
- source listing title used as a core reservation key
- provider raw status used as the authoritative `reservations.status`

Approved homes instead:

- listing/account identities -> provider-edge tables
- raw source payload/status -> `reservation_external_refs` and provider-edge metadata
- non-durable matching handles -> `channel_listing_aliases`

### 8.4 Compatibility before cleanup rule

No downstream task may remove or repoint dashboard-critical legacy reads until a replacement path has been defined and verified against current metrics semantics.

## 9. Deferred / non-v1 entities

The following are explicitly **out of scope for v1** and may appear only in deferred sections, not in v1 migrations:

- `brands`
- `stays`
- folios, charges, accounting ledger, payouts, owner statements
- auth / RBAC tables

Why deferred:

- the plan explicitly excludes them from v1 (`.sisyphus/plans/airbnb-postgres-schema.md:54-58`, `:81-84`)
- Task 0 showed Sprint 1 is already missing reservations, ingestion, frontend abstraction, and auth branch readiness, so expanding to these entities would create avoidable scope creep (`.sisyphus/evidence/task-0-gap-audit.md:151-160`)

## 10. Why this contract satisfies Task 0 findings

This contract resolves the specific Task 0 gaps without breaking the current dashboard baseline:

| Task 0 finding | Contract response |
|---|---|
| Current schema has no `reservations` core (`.sisyphus/evidence/task-0-gap-audit.md:57-60`, `:77-81`) | Adds `reservations` plus `reservation_room_allocations` as the new booking core. |
| `guests` collapses guest and booking concepts (`.sisyphus/evidence/task-0-gap-audit.md:79-81`, `:97-102`) | Keeps `guests` as transitional compatibility only; does not pretend it is the long-term core. |
| No provider-edge model exists for listings/accounts/external refs (`.sisyphus/evidence/task-0-gap-audit.md:80-81`, `:100-101`) | Adds `channels`, `external_accounts`, `channel_listings`, `channel_listing_aliases`, `listing_room_mappings`, and `reservation_external_refs`. |
| Dashboard arrivals/departures are guest-status based (`.sisyphus/evidence/task-0-gap-audit.md:58-60`, `:147-157`) | Preserves the legacy `guests` table during cutover and defines an explicit reservation-status mapping path. |
| Additive migration is required (`supabase/migrations/AGENTS.md:13-18`; `.sisyphus/plans/airbnb-postgres-schema.md:72-88`) | Anti-destruction rules forbid early rename/drop of current runtime tables. |
| Listing titles/internal names are unstable (`database_design/db-schema-airbnb.md:17-20`) | Moves them into alias/mapping tables rather than treating them as durable keys. |

## 11. Implementation checklist for downstream tasks

Before any migration SQL is considered valid, it must conform to this contract:

1. Only the approved v1 tables are introduced.
2. `guests`, `properties`, `rooms`, `guest_requests`, and `maintenance_issues` remain intact through the first cutover wave.
3. `reservations` uses local stay dates and constrained normalized core statuses.
4. Provider account/listing/reference data lives only in provider-edge tables.
5. Composite listing support is implemented with mapping/allocation tables, not a single `room_id` assumption.
6. Raw provider statuses remain edge metadata, never the authoritative core status vocabulary.
