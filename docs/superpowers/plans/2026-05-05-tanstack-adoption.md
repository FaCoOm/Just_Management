# TanStack Adoption Plan

> For this React 19 + Vite dashboard app, adopt TanStack incrementally. Do not migrate to TanStack Start in the initial phase.

## Installed baseline

- `@tanstack/react-query`
- `@tanstack/react-query-devtools`
- `@tanstack/react-router`
- `@tanstack/react-router-devtools`
- `@tanstack/react-table`
- `@tanstack/react-virtual`

## Deferred

- `@tanstack/react-form` — defer because the app already has `react-hook-form` + `zod`, and there are no major feature forms yet.
- `@tanstack/react-start` — defer because it is a full-stack framework migration, not a normal library add-on for the current client-side Vite app.

## Why this split fits the current repo

- `src/App.tsx` currently uses local `useState` page switching instead of URL routing.
- `src/main.tsx` already has a clean provider insertion point for Query/Router providers.
- `src/hooks/use-dashboard-data.ts` uses `useEffect` + `Promise.all` over the repository layer, which maps well to TanStack Query.
- `src/lib/repositories/rest-repositories.ts` already provides async boundaries that can become query functions without replacing the data-access layer.
- `src/components/reservations/reservations-page.tsx`, `src/components/guests/guests-page.tsx`, and `src/components/maintenance/maintenance-page.tsx` use hand-built tables, making them natural TanStack Table candidates.

## Phase 1 — Query foundation

### Files to touch

- `src/main.tsx`
- `src/lib/` or `src/hooks/` for shared query client and query key helpers
- `src/hooks/use-dashboard-data.ts`

### Changes

1. Add a shared `QueryClient` with conservative defaults.
2. Wrap the app in `QueryClientProvider`.
3. Add `ReactQueryDevtools` in development.
4. Convert `useDashboardData` from a mount-time `useEffect` fetch to TanStack Query queries.
5. Keep the derived `guests`, `metrics`, and `totals` calculations in the hook for now so the UI contract stays stable.

### Goal

Get caching, invalidation, cleaner loading states, and a stable server-state foundation without forcing a page-architecture rewrite.

## Phase 2 — Router migration

### Files to touch

- `src/main.tsx`
- `src/App.tsx`
- `src/components/app-sidebar.tsx`
- New route files under a router structure chosen during implementation

### Changes

1. Replace local `currentPage` state in `App.tsx` with TanStack Router.
2. Map current pages to routes: dashboard, reservations, guests, rooms, maintenance.
3. Update sidebar navigation to use router links/navigation instead of callback props.
4. Keep the visual shell intact while moving navigation state into the URL.

### Goal

Turn the app into a URL-addressable SPA with minimal UI churn.

## Phase 3 — Table upgrades

### Files to touch

- `src/components/reservations/reservations-page.tsx`
- `src/components/guests/guests-page.tsx`
- `src/components/maintenance/maintenance-page.tsx`
- Potential shared table helpers/components under feature code

### Changes

1. Introduce TanStack Table where current manual filtering/sorting logic is starting to sprawl.
2. Keep the existing shadcn table primitives for rendering.
3. Add sorting, better filtering state, and pagination progressively.

### Goal

Improve data-grid behavior without replacing the visual design system.

## Phase 4 — Virtualization where justified

### Trigger

Use TanStack Virtual only when lists/tables become large enough for DOM/rendering cost to matter.

### Likely targets

- Reservations list
- Guests list
- Maintenance list
- Any future dense operational grids

## Phase 5 — Revisit Form and Start

### TanStack Form

Re-evaluate only when the app starts shipping larger create/edit workflows and the existing `react-hook-form` composition becomes a bottleneck.

### TanStack Start

Re-evaluate only if the product intentionally moves toward SSR, server functions, streaming, or a full-stack framework model.

## Verification standard

After each implementation phase:

1. Run `npm run typecheck`
2. Run `npm run build`
3. Manually smoke-test the affected UI flow

## Recommended next implementation order

1. Ship Phase 1 first: Query provider + `useDashboardData` migration.
2. Ship Phase 2 second: Router migration.
3. Upgrade one table page first, preferably reservations, before rolling TanStack Table across all pages.
