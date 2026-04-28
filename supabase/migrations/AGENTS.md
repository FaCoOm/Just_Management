# Supabase Migrations Guide

## Scope
- This folder owns SQL schema and seed data.
- Current files cover schema creation plus demo portfolio seeding.

## Current Contract
- Core tables: `properties`, `rooms`, `guests`, `guest_requests`, `maintenance_issues`.
- The frontend reads these tables through `src/hooks/use-dashboard-data.ts`.
- Frontend type expectations live in `src/types/database.ts`.
- Schema drift here will surface as broken UI and type mismatches there.

## Migration Rules
- Keep migrations small and purpose-specific.
- Follow the existing timestamped filename pattern.
- Enable RLS for new tables unless the task explicitly changes the security model.
- Review policies as carefully as schema because the dashboard currently depends on public demo reads.
- Prefer additive changes over destructive rewrites.

## Seed Data Rules
- Treat seed files as demo data, not production truth.
- Preserve relationship integrity across properties, rooms, guests, requests, and maintenance issues.
- Keep idempotent patterns like `ON CONFLICT ... DO NOTHING` when extending stable seed rows.
- Be careful with procedural seed blocks because one change can fan out across many generated rows.

## Verification
- Reconcile schema changes with `src/types/database.ts`.
- Reconcile column or table changes with `src/hooks/use-dashboard-data.ts` queries.
- Watch for RLS or policy regressions if data stops appearing in the dashboard.
- Run `npm run typecheck` and `npm run build` after frontend-facing schema changes are mirrored locally.
