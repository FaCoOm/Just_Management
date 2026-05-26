# Backend Subsystem Guide

## Scope
- `backend/` owns Track B Express API, Prisma access, ingestion routes, and backend verification scripts.
- Frontend repository code consumes HTTP responses; it must not import Prisma or backend internals.

## Real Entry Points
- `src/index.ts` registers middleware, health/API routes, dashboard summary, stats, and `registerIngestRoutes(app)`.
- `src/ingest/routes.ts` owns `/api/ingest/*` request validation and upload handling.
- `prisma/schema.prisma` is canonical Track B schema source.
- `scripts/verify-azure-migration.mjs` and `scripts/verify-ingestion.ts` are backend guardrails.

## Where To Edit
| Change | Location | Notes |
|---|---|---|
| API response shape | `src/index.ts` | Keep compatible with `src/lib/repositories/types.ts`. |
| Ingestion contract | `src/ingest/contracts.ts` | Validate before service writes. |
| Spreadsheet parsing | `src/ingest/parser.ts`, `src/ingest/normalizer.ts` | Keep raw parsing separate from canonical normalization. |
| Provider sync behavior | `src/ingest/services/` | Keep provider-specific logic at edge. |
| Schema or migration | `prisma/` | Follow `backend/prisma/AGENTS.md`. |

## Conventions
- Use typed request parsing and explicit validation before reading query/body values.
- Keep Prisma access in backend code only.
- Keep provider IDs, raw statuses, and raw payloads at provider-edge tables or metadata.
- Configure origins through `ALLOWED_ORIGINS`; do not hardcode production origins in code.
- Preserve cache headers intentionally: list/detail/dashboard routes use different freshness expectations.

## Anti-Patterns
- Do not move Prisma queries into frontend repositories or components.
- Do not bypass Prisma migrations with ad hoc database changes.
- Do not apply `supabase/migrations/*.sql` to Azure PostgreSQL.
- Do not leak room passcodes or privileged fields through public DTOs without protected route design.

## Commands
```bash
npm run dev
npm run build
npm run db:generate
npm run db:validate
npm run db:verify:migration
npm run verify-ingestion
npm run verify:all
```

## Verification
- Backend code change: `npm run build`.
- Prisma/schema change: `npm run db:generate`, `npm run db:validate`, `npm run db:verify:migration`.
- Ingestion change: `npm run verify-ingestion` or `npm run verify:all`.
- Endpoint behavior change: run backend and hit affected route; report actual response/status.