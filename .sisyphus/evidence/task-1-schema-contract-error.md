# Task 1 Guardrail Regression Check

## Purpose

This file records the prohibited decisions for Task 1 so downstream migration work can be checked against them quickly.

## Rejected decisions

| Prohibited decision | Result | Reason / governing evidence |
|---|---|---|
| `DROP TABLE guests` in the initial migration wave | **Rejected** | Current runtime reads `guests` directly and derives arrivals/departures from it (`src/hooks/use-dashboard-data.ts:38-43`, `:70-75`); the plan forbids destructive early cutover (`.sisyphus/plans/airbnb-postgres-schema.md:35`, `:72`, `:87`). |
| `ALTER TABLE guests RENAME ...` before compatibility is in place | **Rejected** | `src/types/database.ts:39-51` and current dashboard reads still depend on the legacy table/field naming. |
| Treating `guests` as the new reservations core | **Rejected** | Task 0 explicitly rejected that claim (`.sisyphus/evidence/task-0-gap-audit-error.md:9-15`). |
| Adding Airbnb-specific identity columns directly to `properties`, `rooms`, or `reservations` | **Rejected** | The plan requires a provider-edge seam and forbids provider leakage into core tables (`.sisyphus/plans/airbnb-postgres-schema.md:33-38`, `:85-87`). |
| Using listing title or internal name as a durable listing/reservation key | **Rejected** | Existing design notes show names are variable and composite (`database_design/db-schema-airbnb.md:17-20`); alias tables exist specifically to avoid this mistake. |
| Using provider raw status as authoritative reservation state | **Rejected** | Current dashboard semantics require a stable operational vocabulary, while provider raw states belong in edge refs/metadata (`src/hooks/use-dashboard-data.ts:70-75`; `.sisyphus/evidence/task-1-schema-contract.md:154-236`). |
| Reintroducing `brands` into v1 | **Rejected** | The canonical v1 inventory defers `brands` (`.sisyphus/plans/airbnb-postgres-schema.md:54-58`, `:81-84`). |
| Introducing `stays`, payouts, folios, accounting, or auth/RBAC tables in Task 1 | **Rejected** | Those entities are explicitly deferred from v1 scope (`.sisyphus/plans/airbnb-postgres-schema.md:54-58`, `:81-84`). |

## Quick scan phrases that should remain absent from first-wave migrations

- `DROP TABLE guests`
- `ALTER TABLE guests RENAME`
- `DROP TABLE properties`
- `DROP TABLE rooms`
- `DROP TABLE guest_requests`
- `DROP TABLE maintenance_issues`
- `airbnb_listing_id` on `rooms`
- `airbnb_account_id` on `properties`
- `airbnb_status` as the core reservation status column
- `brands` table creation in v1 migration files
- `stays` table creation in v1 migration files

## Outcome

Task 1 passes only if downstream work uses the additive reservation-core design while preserving the current dashboard contract long enough for later migration tasks to move the frontend safely.
