<!-- intent-skills:start -->
## Skill Loading

Before substantial work:
- Skill check: run `npx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# M_Management Track B Agent Guide

## OpenCode Behavioral Overlay

Apply these Karpathy-style rules before touching code or docs. They are adapted from the public `forrestchang/andrej-karpathy-skills` repository, but tailored for this OpenCode repo instead of Claude Code or Cursor installation flows.

### 1. Think Before Coding
- State assumptions explicitly when the request can mean more than one thing.
- Do not silently choose between materially different interpretations.
- If a simpler implementation exists, say so before building the heavier one.
- If confusion remains after exploration, name it clearly instead of guessing.

### 2. Simplicity First
- Implement exactly what was requested and nothing speculative.
- Do not add abstractions, configurability, or extension points without a concrete need in this repo.
- Prefer the smallest diff that satisfies the request.
- If a solution feels larger than the problem, reduce it.

### 3. Surgical Changes
- Touch only files that are directly relevant to the task.
- Do not “clean up” adjacent code, comments, or formatting unless your change requires it.
- Match existing repo patterns even if you would design them differently from scratch.
- Remove only the dead code your own change creates; mention pre-existing dead code instead of deleting it.

### 4. Goal-Driven Execution
- Convert vague work into explicit pass/fail outcomes before implementation.
- For multi-step work, state a short plan with verification after each step.
- Do not claim success without evidence from real checks in this repo.
- Manual QA is required for behavior changes; type checks alone are not enough.

## Snapshot
- Hospitality operations dashboard for 8 Vietnamese properties.
- This worktree is **Track B**: a shared React 19 + TypeScript + Vite 7 frontend backed by a custom Node/Express + Prisma backend for Azure PostgreSQL.
- Frontend UI stack: Tailwind CSS v4, shadcn/ui, Lucide, Recharts, TanStack Query, TanStack Router.
- Frontend data access is **repository-driven** through `src/lib/repositories/`; `src/hooks/use-dashboard-data.ts` currently calls `createRestRepositories()`.
- Booking source of truth is `reservations`; `guests` is a legacy compatibility model for guest-labeled UI surfaces.
- `supabase/migrations/` in this repo is **reference-only schema intent**. Azure deployment uses `backend/prisma/schema.prisma` and generated Prisma migrations.
- Treat older docs that describe the pre-repository or Supabase-first Track A runtime as historical context unless they agree with the current Track B README, repository code, and backend files.

## Real Entry Points
- `src/main.tsx` mounts the frontend app.
- `src/App.tsx` builds the shell around the dashboard experience.
- `src/components/dashboard/dashboard-page.tsx` is the main dashboard assembly point.
- `src/hooks/use-dashboard-data.ts` is the frontend dashboard contract; it loads repository data and maps reservations into the legacy guest-shaped view model.
- `src/lib/repositories/index.ts` exports the Track B REST repository factory.
- `src/lib/repositories/types.ts` defines the branch-neutral repository interfaces the frontend depends on.
- `backend/src/index.ts` is the Express API entry point.
- `backend/src/ingest/` contains ingestion parsing, normalization, services, and routes.
- `backend/prisma/schema.prisma` is the canonical Track B schema source.
- `backend/prisma/migrations/` is the deployable migration history for Azure PostgreSQL.

## Structure
- `src/components/dashboard/` — app-specific dashboard panels and composition.
- `src/components/ui/` — reusable primitives; prefer composition over editing them directly.
- `src/hooks/` — shared hooks; dashboard derivations belong here, not in presentation components.
- `src/lib/repositories/` — frontend repository contracts and REST implementation.
- `src/types/` — shared frontend models and unions.
- `backend/src/` — Express API handlers and ingestion logic.
- `backend/src/ingest/` — spreadsheet ingestion contracts, parser, normalizer, route registration, and provider-sync services.
- `backend/prisma/` — canonical Track B data model and migrations.
- `backend/scripts/` — backend verification helpers such as migration and ingestion checks.
- `supabase/migrations/` — Track A schema-intent reference only; do not deploy these to Azure.
- `plans/` and `.sisyphus/plans/` — product and implementation planning artifacts.

## Current Data Model
- Retained operational core: `properties`, `rooms`, `guests`, `guest_requests`, `maintenance_issues`.
- Reservation core: `reservations`, `reservation_room_allocations`.
- Provider edge: `channels`, `external_accounts`, `channel_listings`, `channel_listing_aliases`, `listing_room_mappings`, `reservation_external_refs`.
- Import and reconciliation: `legacy_guest_reservation_backfills`, `provider_reservation_import_rows`, plus related import metadata and sync fields in Track B.
- Deferred beyond current scope: full PMS lifecycle (`stays`, folios/charges, room moves), owner/accounting ledgers, and production-grade auth/RBAC.

## Where To Edit
| Change | Primary location | Notes |
|---|---|---|
| Dashboard layout or panel ordering | `src/components/dashboard/dashboard-page.tsx` | Keep orchestration here. |
| New panel or panel-specific rendering | `src/components/dashboard/` | Prefer props-driven panels. |
| New dashboard metric or derived value | `src/hooks/use-dashboard-data.ts` | Keep calculations centralized and preserve existing KPI semantics. |
| Frontend repository contract | `src/lib/repositories/types.ts` | Update this before changing frontend repository consumers. |
| Track B frontend data access | `src/lib/repositories/rest-repositories.ts` | Frontend network access belongs here, not in hooks or panels. |
| Frontend schema or field contract | `src/types/database.ts` | Update before consuming new fields in hooks/UI. |
| Backend API contract | `backend/src/index.ts` | Keep response shapes compatible with repository interfaces. |
| Ingestion flow | `backend/src/ingest/` | Keep parser, normalizer, routes, and provider services focused by responsibility. |
| Track B canonical schema | `backend/prisma/schema.prisma` | Update schema first, then generate or adjust Prisma migrations. |
| Track B deployable migrations | `backend/prisma/migrations/` | These are the Azure-safe migrations. |
| Track A schema reference | `supabase/migrations/` | Update only when intentionally mirroring schema intent; these files are not deploy targets. |
| Theme tokens, fonts, global styles | `src/index.css` | Use the existing Harbor/Brass token system. |

## Conventions
- Use `@/*` imports for internal frontend paths.
- Keep dashboard business logic in hooks or repositories, not in UI primitives.
- Treat `src/components/ui` as generic building blocks with stable APIs.
- Match the existing visual system: Harbor primary, Harbor Deep secondary, Brass accents, `Newsreader` headings, `Plus Jakarta Sans` body text.
- Keep frontend typing explicit; shared contracts live in `src/types/database.ts` and `src/lib/repositories/types.ts`.
- Preserve the repository boundary: frontend code should consume repositories, and backend code should own Prisma access.
- Preserve additive migration style. Do not drop legacy compatibility structures during transitional work unless a plan explicitly authorizes it.
- Keep provider-specific identifiers and raw statuses at the provider edge; do not leak them into core operational tables without intent.
- For backend TypeScript, prefer typed request parsing and explicit validation over loose or implicit coercion.

## Anti-Patterns
- Do not revive a Supabase-first runtime in this worktree.
- Do not put fetch calls, REST endpoint construction, or Prisma assumptions directly into dashboard panels.
- Do not put dashboard semantics, booking logic, or backend data access into `src/components/ui` primitives.
- Do not treat `guests` as the authoritative booking table; `reservations` is authoritative.
- Do not apply `supabase/migrations/*.sql` directly to Azure PostgreSQL.
- Do not copy Track A auth-adapter guidance into this repo unless those files actually exist here.
- Do not hardcode secrets, API keys, database URLs, or allowed origins.
- Do not trust older docs when they conflict with the current Track B README, repository code, Prisma schema, or backend package scripts.

## Commands
Frontend:
```bash
npm run dev
npm run typecheck
npm run build
npm run preview
```

Combined frontend + backend dev:
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

## Verification
- There is no full automated test suite or CI pipeline in this repo.
- Standard frontend verification is `npm run typecheck` and `npm run build` from repo root.
- Standard backend verification is `cd backend && npm run build`.
- For Prisma/schema work, also run `cd backend && npm run db:generate` and `cd backend && npm run db:validate`.
- For migration safety work, run `cd backend && npm run db:verify:migration`.
- For ingestion changes, run `cd backend && npm run verify-ingestion` or `npm run verify:all`.
- For user-visible behavior changes, run the affected app or endpoint and report actual observed output; do not stop at type checks.

## Reference Docs
- `README.md` — current Track B runtime overview.
- `src/components/dashboard/AGENTS.md` — dashboard composition and data-placement rules.
- `src/components/ui/AGENTS.md` — primitive edit guardrails.
- `supabase/migrations/AGENTS.md` — reference-only SQL guidance for Track B.
- `backend/prisma/schema.prisma` — canonical Track B schema.
- `backend/src/index.ts` — current API surface.

## Local Overrides
- `src/components/dashboard/AGENTS.md` — panel composition and dashboard data-contract rules.
- `src/components/ui/AGENTS.md` — reusable primitive guardrails.
- `supabase/migrations/AGENTS.md` — Track B SQL reference-only rules.
