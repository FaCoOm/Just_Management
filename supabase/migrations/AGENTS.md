# Track B SQL Reference Migrations

**IMPORTANT: These SQL files are schema-intent reference only. They mirror Track A Supabase
migrations for documentation and design purposes.**

## Do NOT deploy these to Azure PostgreSQL.

Azure deployment uses `backend/prisma/migrations/` generated from `backend/prisma/schema.prisma`.

Supabase RLS policies in these files (roles `anon`, `authenticated`, RLS enablement) are Supabase-only
and **will fail** on Azure PostgreSQL. The Prisma migration is the canonical schema source for Azure.

## What these files are good for:
- Understanding the business schema contract
- Comparing Track A vs Track B parity
- Documenting intended constraints, indexes, and seed data patterns
- Reference when adding new features that need schema changes (update
  `backend/prisma/schema.prisma` first, then generate a new migration)

## What these files are NOT:
- Executable migration SQL for Azure
- The source of truth for Track B deployment
- A replacement for Prisma migrations

## Verification for Track B
- Run `cd backend && npm run db:verify:migration` to check the Prisma migration.
- Run `cd backend && npm run db:validate` to validate the Prisma schema.
- Run `cd backend && npm run build` to confirm backend TypeScript with generated client.
