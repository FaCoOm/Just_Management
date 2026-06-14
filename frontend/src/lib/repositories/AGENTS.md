# Frontend Repository Contract Guide

## Scope
- `frontend/src/lib/repositories/` is frontend data-access seam for Track B REST backend.
- Hooks and pages consume repository interfaces; only this folder constructs API requests.

## Files
- `types.ts` defines contract interfaces and dashboard summary shape.
- `rest-repositories.ts` implements those contracts with `fetch` against Express routes.
- `index.ts` is the barrel export for repository consumers.

## Workflow
1. Change `types.ts` first when adding repository methods or returned fields.
2. Update `rest-repositories.ts` to satisfy the contract.
3. Update backend route response in `backend/src/index.ts` if contract needs new data.
4. Update consumers such as `frontend/src/hooks/use-dashboard-data.ts` after contract and implementation agree.

## Rules
- Keep `fetch`, API URL construction, and query-string building in `rest-repositories.ts`.
- Keep response shapes aligned with `backend/src/index.ts`.
- Do not import from `@/components` or `@/hooks` here.
- Do not encode Prisma model assumptions beyond shared frontend types.
- Keep provider raw fields out of frontend contracts unless UI explicitly needs them.

## Anti-Patterns
- Fetching directly from dashboard panels, page components, or hooks.
- Adding a method to `rest-repositories.ts` without declaring it in `types.ts`.
- Reintroducing Supabase runtime adapters in this Track B worktree.
- Returning backend-only fields just because Prisma exposes them.

## Verification
```bash
npm run typecheck
npm run build
```

For behavior changes, run frontend with backend and confirm affected page loads from REST route.