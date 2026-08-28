# Frontend Workspace Guide

## Rules
- No backend internals, Prisma, Supabase clients, or Track A runtime branches.
- Only `src/lib/repositories/rest-repositories.ts` constructs API calls.
- Components consume hooks/repos; dashboard panels stay props-driven where possible.
- UI primitives stay generic: no hospitality/business semantics.
- Root `.env` is canonical (`envDir: "../"`); `@/*` aliases to `src/*`.

## Routing
- New feature page: `src/components/<feature>/<feature>-page.tsx`, registered in `src/router.tsx` with `lazyRouteComponent`.
- `src/pages/` is only for `settings/integrations-page.tsx` unless architecture changes.
