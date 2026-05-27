# Track B Performance Plan

## Scope

Track B only. Runtime data source stays Azure PostgreSQL through Express, Prisma, and REST repositories. `supabase/migrations/` remains reference-only and is not part of this implementation.

## Current Findings

- `src/hooks/use-dashboard-data.ts` currently issues seven dashboard-wide queries for every page that calls it.
- Dashboard, Reservations, Guests, Rooms, and Maintenance pages all call `useDashboardData`, so each page can fetch unrelated datasets.
- Backend list endpoints in `backend/src/index.ts` use unpaginated `findMany` calls and mostly return full rows.
- Dashboard metrics are calculated client-side after fetching broad datasets.
- `src/router.tsx` imports all route page modules up front, so initial load includes non-current pages.
- `src/lib/query-client.ts` has a useful base cache config, but cache lifetimes are not domain-specific.

## Acceptance Criteria

1. Persist this plan before code changes.
   - QA: read this file and confirm Track B-only scope.
2. Reduce route-to-route data overfetching.
   - QA: run `git grep -n "useDashboardData" -- src/components`; expected result is only dashboard orchestration uses the full dashboard hook.
3. Add backend-safe high-concurrency improvements without destructive migration behavior.
   - QA: run `cd backend && npm run build && npm run db:validate && npm run db:verify:migration`; expected result is exit code 0 for all commands.
4. Reduce initial JS load where safe.
   - QA: run `git grep -n "lazyRouteComponent" -- src/router.tsx`; expected result lists every app route component.
5. Verify with real commands and manual API/browser checks.
   - QA: run LSP diagnostics on modified TypeScript files, `npm run typecheck`, `npm run build`, and API smoke checks against a running backend: `/health`, `/api/reservations?limit=25&offset=0`, `/api/rooms?limit=25&offset=0`, `/api/stats/occupancy?days=30`. Expected result: zero new diagnostics, build/typecheck exit code 0, API responses are successful JSON and paginated list responses include `X-Total-Count`.

## Implementation Plan

1. Consult frontend, backend, and external best-practice agents in parallel.
2. Keep the first implementation surgical:
   - add page-specific lightweight hooks or query helpers;
   - tune Query cache lifetimes where safe;
   - lazy-load route pages;
   - add backend pagination/select/compression/index improvements only where low-risk and directly supported by current routes.
3. Avoid adding broad new features, auth, Supabase runtime, or dashboard redesign.
4. Verify after code changes with repo commands and manual runtime checks.

## Likely Files

- `src/router.tsx`
- `src/lib/query-client.ts`
- `src/lib/query-keys.ts`
- `src/hooks/use-dashboard-data.ts`
- `src/hooks/*` for page-specific data hooks if needed
- `src/lib/repositories/types.ts`
- `src/lib/repositories/rest-repositories.ts`
- `backend/src/index.ts`
- `backend/prisma/schema.prisma` only if indexes are added

## Guardrails

- No Supabase-first runtime revival.
- No direct frontend Prisma access.
- No fetch calls inside dashboard panels.
- No destructive migrations.
- No broad refactor beyond performance objective.
