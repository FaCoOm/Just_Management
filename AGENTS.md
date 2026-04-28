# M_Management Agent Guide

## Snapshot
- Hospitality operations dashboard for 8 Vietnamese properties.
- Frontend stack: React 19, TypeScript, Vite 7.
- UI stack: Tailwind CSS v4, shadcn/ui, Lucide, Recharts.
- Data path today: `src/hooks/use-dashboard-data.ts` reads Supabase tables directly.
- Important caveat: `ARCHITECTURE.md`, `IMPLEMENTATION.md`, and `NEXT_STEPS.md` still describe an older `src/data` flow. Treat them as historical context, not current runtime truth.

## Real Entry Points
- `src/main.tsx` mounts `App` inside `ThemeProvider`.
- `src/App.tsx` builds the shell: `SidebarProvider` → `AppSidebar` → `DashboardPage`.
- `src/components/dashboard/dashboard-page.tsx` is the main feature assembly point.
- `src/hooks/use-dashboard-data.ts` is the current data and totals contract.
- `src/types/database.ts` is the frontend schema contract.
- `src/index.css` defines the Harbor & Hearth design tokens and Tailwind v4 `@theme inline` mapping.

## Structure
- `src/components/dashboard/` — app-specific panels and dashboard composition.
- `src/components/ui/` — reusable shadcn/ui-style primitives; usually compose, do not customize in place.
- `src/hooks/` — shared hooks; `use-dashboard-data.ts` is the important one.
- `src/lib/` — Supabase client and shared utilities.
- `src/types/` — shared data interfaces and string unions.
- `supabase/migrations/` — schema and seed SQL.

## Where To Edit
| Change | Primary location | Notes |
|---|---|---|
| Dashboard layout or panel ordering | `src/components/dashboard/dashboard-page.tsx` | Keep orchestration here. |
| New panel or panel-specific rendering | `src/components/dashboard/` | Prefer props-driven panels. |
| New metric or shared dashboard-derived value | `src/hooks/use-dashboard-data.ts` | Do not duplicate calculations across panels. |
| Schema or field contract | `src/types/database.ts` | Update before touching consuming UI. |
| Theme tokens, fonts, global color utilities | `src/index.css` | Use existing Harbor/Brass token system. |
| Supabase client setup | `src/lib/supabase.ts` | Client comes straight from Vite env vars. |
| SQL schema or seed changes | `supabase/migrations/` | See local AGENTS there. |

## Conventions
- Use `@/*` imports for internal paths.
- Keep dashboard business logic in feature code or hooks, not in UI primitives.
- Treat `src/components/ui` as generic building blocks with stable APIs.
- Match the existing visual system: Harbor primary, Harbor Deep secondary, Brass status accents, `Newsreader` headings, `Plus Jakarta Sans` body text.
- Use Tailwind utilities and token-backed classes instead of ad hoc styling.
- Keep data typing explicit; frontend models live in `src/types/database.ts`.

## Anti-Patterns
- Do not revive `src/data` as the active runtime source without first reconciling the current Supabase-based hook flow.
- Do not put dashboard semantics, guest logic, or Supabase queries into `src/components/ui` primitives.
- Do not hardcode Supabase credentials or bypass `import.meta.env` in `src/lib/supabase.ts`.
- Do not trust the older docs blindly when they conflict with current code.

## Commands
```bash
npm run dev
npm run typecheck
npm run build
npm run preview
```

## Verification
- There is no test suite and no CI workflow in this repo.
- Standard verification is `npm run typecheck` and `npm run build`.
- Manual UI checks matter for layout changes because automated coverage does not exist.

## Local Overrides
- `src/components/dashboard/AGENTS.md` — panel composition and data-placement rules.
- `src/components/ui/AGENTS.md` — primitive edit guardrails.
- `supabase/migrations/AGENTS.md` — SQL schema, RLS, and seed-data rules.
