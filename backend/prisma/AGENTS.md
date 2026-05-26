# Prisma Schema Guide

## Scope
- `backend/prisma/` is canonical Track B schema and deployable Azure PostgreSQL migration history.
- `schema.prisma` describes current model truth; `migrations/` records deployable history.

## Source Of Truth
- Edit `schema.prisma` first for schema changes.
- Generate or adjust Prisma migrations from that schema.
- Keep schema and migration changes together in same work item.
- Treat `supabase/migrations/` as reference intent only, never deploy input.

## Workflow
1. Update `schema.prisma`.
2. Run from `backend/`: `npm run db:generate`.
3. Create/review Prisma migration SQL.
4. Run `npm run db:validate`.
5. Run `npm run db:verify:migration`.

## Rules
- Preserve additive migration style during Track B transition.
- Do not drop `guests`, `legacy_guest_reservation_backfills`, or provider import tables without explicit approved plan.
- Keep `reservations` as booking source of truth; `guests` remains compatibility surface.
- Keep Azure SQL free of Supabase RLS syntax: `anon`, `authenticated`, `service_role`, `ENABLE ROW LEVEL SECURITY`.
- Never edit an already-applied migration to hide drift; create a new migration.

## Anti-Patterns
- Copying SQL from `supabase/migrations/` into Prisma migration history.
- Manual `psql` schema changes outside Prisma migration flow.
- Changing Prisma models without updating backend DTO/API expectations.
- Removing compatibility structures because frontend no longer reads one path today.

## Verification
```bash
npm run db:generate
npm run db:validate
npm run db:verify:migration
npm run build
```