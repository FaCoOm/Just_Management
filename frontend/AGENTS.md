# Frontend Workspace Guide

## Scope
- `frontend/` is the React 19 + TypeScript + Vite 7 workspace; runs as npm workspace `frontend`.
- Frontend never imports backend internals or Prisma; it consumes REST responses through repositories only.

## Layout
- `src/main.tsx` mounts React, QueryClient, theme provider, and `RouterProvider`.
- `src/router.tsx` declares lazy TanStack routes against `@/components/<feature>/<feature>-page` and `@/pages/settings/integrations-page`.
- `src/components/<feature>/` holds feature pages and panels; `src/components/ui/` holds shadcn primitives.
- `src/hooks/`, `src/lib/`, `src/lib/repositories/`, `src/types/` are documented in their own AGENTS.md.
- `src/test/` holds Vitest specs; `src/test/setup.ts` configures jsdom + testing-library.

## Routing Convention
- New page: create `src/components/<feature>/<feature>-page.tsx` exporting a named component, then register it in `src/router.tsx` with `lazyRouteComponent`.
- `src/pages/` exists only for `settings/integrations-page.tsx`; do not expand it without an architecture decision.

## Vite Specifics
- `envDir: "../"` reads env from repo root, not `frontend/`. `.env` lives at root.
- Dev proxy forwards `/api/*` to `http://localhost:3001`; backend must be running for data to load.
- `@/*` aliases to `frontend/src/*`.

## Anti-Patterns
- Do not call `fetch` directly outside `src/lib/repositories/rest-repositories.ts`.
- Do not put a `.env` inside `frontend/`; root `.env` is canonical.
- Do not add Supabase clients or `VITE_TRACK=A` runtime branches; the Track A path is removed.
- Do not import from `backend/` or `@prisma/client` here.

## Commands
```
npm run dev        # vite, port 5173
npm run typecheck  # tsc --noEmit
npm run build      # tsc -b && vite build
npm run test:frontend
```

## Verification
- Type changes: `npm run typecheck` from `frontend/`.
- Build/import changes: `npm run build` from `frontend/`.
- Behavior changes: run `npm run dev:all` from repo root and exercise affected route.
