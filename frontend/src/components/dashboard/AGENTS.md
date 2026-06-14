# Dashboard Feature Guide

## Scope
- This folder is for app-specific dashboard views, not reusable primitives.
- `dashboard-page.tsx` is the orchestration layer.
- Individual files here should stay focused on one panel or one dashboard surface.

## Composition Rules
- Keep data fetching out of panels.
- Let `DashboardPage` wire together `DashboardHeader`, panels, loading states, and `BookingsPanel` visibility.
- Keep panels props-driven when possible.
- Put shared dashboard calculations in the hook, not in multiple panel files.

## Data Contract
- Source of truth: `frontend/src/hooks/use-dashboard-data.ts`.
- Shared types: `frontend/src/types/database.ts`.
- If a panel needs a new derived value, add it to the hook or the shared types first.
- If a change affects many panels, update the hook contract before touching presentation.

## Change Placement
- New panel: add a file here and register it in `dashboard-page.tsx`.
- Layout change: edit `dashboard-page.tsx` first.
- Metric change: edit `use-dashboard-data.ts`.
- Schema field change: update `frontend/src/types/database.ts` and then repair consumers.
- Primitive styling issue: prefer wrapper classes or feature-level composition before editing `frontend/src/components/ui`.

## Responsive Expectations
- The main content and `BookingsPanel` split is intentional.
- Preserve the existing `xl` sidebar behavior unless the task explicitly changes layout rules.
- Keep dashboard grids and spacing consistent with current `gap-*`, `p-*`, and breakpoint patterns.

## Verification
- Run `npm run typecheck` after prop or contract changes.
- Run `npm run build` after layout or import changes.
- Manually check dashboard composition for loading state, desktop layout, and `BookingsPanel` visibility.
