> **Historical. Not current runtime truth.** This sprint status is from 2026-05-02 and reflects a retired architectural phase. The current system uses REST repositories + Express + Prisma + Azure PostgreSQL.


---

# Sprint 1 Status — 2026-05-02

## What exists

### Historical Supabase Schema Reference
- `supabase/migrations/` — 7 SQL reference files (schema intent only; not the active runtime)
- 14 PostgreSQL tables across reservation core, provider edge, operations, and import/backfill

### Current Schema (Azure PostgreSQL)
- `backend/prisma/schema.prisma` — 14-model canonical Azure PostgreSQL schema
- `backend/prisma/migrations/20260502000000_init_track_b/migration.sql` — Azure-ready initial migration
  - Includes `CREATE EXTENSION pgcrypto`, `set_updated_at_timestamp()` trigger, triggers for all 9 tables with `updated_at`
  - No Supabase RLS — uses standard PostgreSQL; Azure deployment path is `npx prisma migrate deploy`

### DB Deployment

The current runtime deploys to Azure PostgreSQL via Prisma migrations:

```bash
cd backend
cp .env.example .env  # Set DATABASE_URL pointing at Azure PostgreSQL Flexible Server
npx prisma generate
npm run db:validate
npm run db:verify:migration
npm run db:deploy
npm run build
```

## Where we stopped

Azure migration path is now established. The Prisma migration contains all 14 tables, indexes, FKs, triggers, and extension setup. Ready for Azure deployment when `DATABASE_URL` is configured.

## What needs to happen next
1. Configure `DATABASE_URL` in `.env` with actual Azure PostgreSQL connection string
2. Run `npm run db:deploy` against Azure PostgreSQL
3. Seed data (optional — Supabase seed SQL is reference-only; Azure seed should be Prisma/API-driven)
4. Verify all endpoints via `npm run dev`

## Plan file
`.sisyphus/plans/airbnb-postgres-schema.md`
