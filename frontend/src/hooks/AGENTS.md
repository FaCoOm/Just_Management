# Hooks Data Contract Guide

## Scope
- `src/hooks/` owns frontend data hooks, Vietnam clock state, and dashboard/page derivations.
- Components consume hook results; they must not build repository clients or fetch data directly.

## Files
- `use-dashboard-data.ts` is the dashboard summary contract and exports `toDashboardGuest`.
- `use-page-data.ts` supplies reservations, guests, rooms, and maintenance page datasets.
- `use-vietnam-clock.ts` is the source for Vietnam-local `today`.
- `use-mobile.ts` is viewport state only; do not mix it with data loading.

## Rules
- Keep `useDashboardData(today)` as the single dashboard data source for dashboard panels.
- Keep reservation-to-legacy-guest compatibility in `toDashboardGuest`, not panels or repositories.
- Use `dashboardKeys.*` from `src/lib/query-keys.ts` for TanStack Query keys.
- Use `REFERENCE_STALE_TIME` style only for stable reference data such as properties and rooms.
- Instantiate repositories inside hooks with `useMemo(() => createRestRepositories(), [])` when needed.
- Preserve Vietnam date semantics by using `useVietnamClock` or backend-provided date keys.

## Anti-Patterns
- Importing `createRestRepositories` inside dashboard panels or page components.
- Adding raw `fetch` calls here instead of using repository methods.
- Duplicating reservation-to-guest mapping outside `toDashboardGuest`.
- Treating `Guest` as database truth; it is a compatibility view model derived from reservations.
- Adding UI layout decisions to hooks.

## Verification
```bash
npm run typecheck
npm run build
```

For data-shape changes, run affected page against backend and confirm query output matches `src/lib/repositories/types.ts`.