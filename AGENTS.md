<!-- intent-skills:start -->
## Skill Loading

Default OpenCode behavior:
- Load and apply local `opencode-karpathy-guidelines` by default for all coding-focused or repository-impacting interactions.
- Comply with `opencode-karpathy-guidelines` before planning, implementation, review, refactoring, or completion claims.
- Treat those guidelines as baseline behavior for all agents and sessions; skip only for casual non-technical chat with no repo or implementation impact.

Before substantial work:
- Run `npx @tanstack/intent@latest list`, or use skills already listed in context.
- If one local skill clearly matches, run `npx @tanstack/intent@latest load <package>#<skill>` and follow returned `SKILL.md`.
- In monorepo-style work, run skill check from workspace root and prefer package-specific local skill.
<!-- intent-skills:end -->

# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-25
**Commit:** b101bd6
**Branch:** main

## OVERVIEW
Hospitality operations dashboard for 8 Vietnamese properties. Track B runtime: React 19 + TypeScript + Vite 7 frontend, TanStack Query/Router, Tailwind CSS v4/shadcn UI, Express + Prisma backend, Azure PostgreSQL.

## STRUCTURE
```text
Just_Management/
├── src/                       # Frontend app, router, hooks, repository seam, UI
├── backend/                   # Express API, Prisma schema/migrations, ingestion
├── backend/prisma/            # Canonical Track B Azure PostgreSQL schema history
├── backend/src/ingest/        # Spreadsheet/provider ingest pipeline
├── supabase/migrations/       # Track A schema-intent reference only
├── docs/analysis/             # Architecture/performance notes; verify against code
├── plans/                     # Product and implementation plans
├── .omo/, .sisyphus/          # Agent state, evidence, plans; not runtime source
└── database_design/           # Source-data mapping and listing classification artifacts
```

## REAL ENTRY POINTS
- `src/main.tsx` mounts React, QueryClient, theme provider, and `RouterProvider`.
- `src/router.tsx` defines TanStack Router shell, sidebar layout, and lazy page routes.
- `src/components/dashboard/dashboard-page.tsx` assembles main dashboard panels.
- `src/hooks/use-dashboard-data.ts` is dashboard data contract; it calls `createRestRepositories()`.
- `src/hooks/use-page-data.ts` supplies reservations, guests, rooms, and maintenance pages.
- `src/lib/repositories/index.ts` exports Track B REST repositories.
- `backend/src/index.ts` is Express API entry point.
- `backend/src/ingest/routes.ts` registers `/api/ingest/*` routes.
- `backend/prisma/schema.prisma` is canonical Track B schema source.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Dashboard layout/panel order | `src/components/dashboard/dashboard-page.tsx` | Keep orchestration here. |
| Dashboard metric or derived value | `src/hooks/use-dashboard-data.ts` | Preserve existing KPI semantics. |
| Page-level data loading | `src/hooks/use-page-data.ts` | Shared page hooks use repositories. |
| Frontend repository contract | `src/lib/repositories/types.ts` | Change contract before consumers. |
| REST data access | `src/lib/repositories/rest-repositories.ts` | Network construction belongs here. |
| Frontend model fields | `src/types/database.ts` | Keep aligned with backend DTOs. |
| Router/sidebar shell | `src/router.tsx` | Lazy routes live here. |
| Backend API contract | `backend/src/index.ts` | Response shapes must satisfy repository types. |
| Ingestion flow | `backend/src/ingest/` | Parser/normalizer/routes/services split. |
| Prisma schema | `backend/prisma/schema.prisma` | Edit before migrations. |
| Azure-safe migrations | `backend/prisma/migrations/` | Deployable Track B history. |
| Theme tokens/global styles | `src/index.css` | Harbor/Brass + typography tokens. |

## CODE MAP
| Symbol | Type | Location | Role |
|---|---|---|---|
| `router` | TanStack router | `src/router.tsx` | Root shell and lazy route tree. |
| `DashboardPage` | Component | `src/components/dashboard/dashboard-page.tsx` | Dashboard composition layer. |
| `useDashboardData` | Hook | `src/hooks/use-dashboard-data.ts` | Dashboard summary contract. |
| `toDashboardGuest` | Mapper | `src/hooks/use-dashboard-data.ts` | Reservation → legacy guest view model. |
| `createRestRepositories` | Factory | `src/lib/repositories/rest-repositories.ts` | Frontend REST adapter. |
| `RepositoryFactory` | Interface | `src/lib/repositories/types.ts` | Frontend data contract. |
| `registerIngestRoutes` | Function | `backend/src/ingest/routes.ts` | Ingest route registration. |
| `schema.prisma` | Prisma schema | `backend/prisma/schema.prisma` | Azure PostgreSQL model truth. |

## CONVENTIONS
- Track B-only current code path: frontend calls REST repositories; no Supabase runtime adapter exists in `src/lib/repositories/`.
- Booking source of truth is `reservations`; `guests` is legacy compatibility for guest-labeled UI.
- Frontend business/data logic belongs in hooks or repositories, not presentation panels or UI primitives.
- Backend owns Prisma access; frontend owns repository interfaces and REST calls only.
- Provider-specific identifiers, raw statuses, and raw payloads stay at provider edge tables/metadata.
- Migration style is additive during transition; do not drop compatibility tables without an approved plan.
- Visual system: Harbor primary, Harbor Deep secondary, Brass accents, `Newsreader` headings, `Plus Jakarta Sans` body.
- Use `@/*` imports for internal frontend paths.

## ANTI-PATTERNS
- Do not revive Supabase-first runtime or add a Supabase repository adapter without explicit architecture decision.
- Do not put fetch calls, endpoint construction, or Prisma assumptions in dashboard panels.
- Do not put dashboard semantics or hospitality-specific logic into `src/components/ui` primitives.
- Do not treat `guests` as authoritative booking data.
- Do not apply `supabase/migrations/*.sql` to Azure PostgreSQL.
- Do not trust README or older docs when they conflict with current code, Prisma schema, or package scripts.
- Do not hardcode secrets, database URLs, API keys, passcodes, or production origins.

## UNIQUE STYLES
- Dashboard pages preserve main-content plus `BookingsPanel` split; `BookingsPanel` appears at `xl` width.
- REST list endpoints may use cache/count behavior intentionally; avoid changing semantics while editing docs or contracts.
- Ingestion uses explicit `dryRun` contract and dead-letter style summaries.

## COMMANDS
Frontend:
```bash
npm run dev
npm run typecheck
npm run build
npm run preview
```

Combined:
```bash
npm run dev:all
npm run build:all
npm run install:all
```

Backend:
```bash
cd backend
npm run dev
npm run build
npm run db:generate
npm run db:validate
npm run db:verify:migration
npm run verify-ingestion
npm run verify:all
```

## VERIFICATION
- Frontend standard: `npm run typecheck`, then `npm run build`.
- Backend standard: `cd backend && npm run build`.
- Prisma/schema work: also run `cd backend && npm run db:generate`, `npm run db:validate`, `npm run db:verify:migration`.
- Ingestion work: run `cd backend && npm run verify-ingestion` or `npm run verify:all`.
- User-visible behavior: run app or endpoint and report observed output.

## LOCAL OVERRIDES
- `backend/AGENTS.md` — backend subsystem rules.
- `backend/prisma/AGENTS.md` — canonical schema and migration rules.
- `backend/src/ingest/AGENTS.md` — ingestion pipeline rules.
- `src/components/dashboard/AGENTS.md` — panel composition and dashboard data-contract rules.
- `src/hooks/AGENTS.md` — frontend data hook and compatibility mapping rules.
- `src/components/ui/AGENTS.md` — reusable primitive guardrails.
- `src/lib/repositories/AGENTS.md` — frontend repository contract rules.
- `supabase/migrations/AGENTS.md` — Track B SQL reference-only rules.

## NOTES
- README still describes old dual Track A/B switching; current code path is Track B REST-only.
- `.omo/`, `.sisyphus/`, `.playwright-mcp/`, `.idea/`, and `.agent/` are tooling/state unless task explicitly targets agent config.
