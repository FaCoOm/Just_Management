# Just Management Dashboard — Technical Architecture

Current architecture is React + REST repositories + Express + Prisma + Azure PostgreSQL. Older Supabase/Track A references in historical docs are reference-only and are not the active runtime.

## System Overview

```text
Browser / Client
  -> React 19 + Vite 7 frontend
  -> TanStack Router routes
  -> TanStack Query hooks
  -> REST repository layer
  -> /api/*
  -> Express backend
  -> Prisma Client
  -> Azure PostgreSQL Flexible Server
```

## Frontend

Real entry points:

- `frontend/src/main.tsx` mounts React, QueryClient, theme provider, and `RouterProvider`.
- `frontend/src/router.tsx` declares lazy routes.
- `frontend/src/components/dashboard/dashboard-page.tsx` composes dashboard panels.
- `frontend/src/hooks/use-dashboard-data.ts` loads dashboard data through repositories.
- `frontend/src/hooks/use-page-data.ts` supplies page-level data.
- `frontend/src/lib/repositories/index.ts` exports the REST repository implementation.

Rules:

- Pages and hooks consume repositories.
- Only `frontend/src/lib/repositories/rest-repositories.ts` constructs API requests.
- Frontend never imports Prisma or backend internals.
- `guests` is a compatibility model; `reservations` is booking source of truth.

## Backend

Real entry points:

- `backend/src/index.ts` registers middleware, routes, dashboard summary, stats, ingestion, One, and tax-export endpoints.
- `backend/src/ingest/routes.ts` registers `/api/ingest/*`.
- `backend/src/routes/one.ts` registers `/api/one/*`.
- `backend/src/tax-export/routes.ts` registers tax-export endpoints.
- `backend/prisma/schema.prisma` is the canonical Azure PostgreSQL schema.

Runtime flow:

```text
HTTP request
  -> Express route
  -> request parsing / validation
  -> Prisma query or service
  -> DTO aligned with frontend repository types
  -> JSON response
```

## Data Model

Canonical schema:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/*/migration.sql`

Core domain boundaries:

- `properties` and `rooms`: physical inventory.
- `reservations`: booking source of truth.
- `guests`: compatibility table/shape for guest-labeled UI.
- `guest_requests` and `maintenance_issues`: operations queues.
- `channels`, `external_accounts`, `channel_listings`, `listing_room_mappings`: provider edge identity and inventory mapping.
- `tax_export_*`: Vietnamese tax-export workflow.

`supabase/migrations/` is schema-intent reference only and must not be applied to Azure.

## Environment

Frontend env lives at repo root because `frontend/vite.config.ts` sets `envDir: "../"`.

Frontend:

- `VITE_TRACK_B_API_URL`: optional backend origin. Empty means same-origin/proxied API calls.
- `VITE_ONE_AUTH_TOKEN_URL`: backend route for WithOne AuthKit token issuance.

Backend:

- `DATABASE_URL`: Azure PostgreSQL connection string.
- `PORT`: Express port, default `3001`.
- `ALLOWED_ORIGINS`: optional CORS allowlist.
- `ONE_CONNECTION_KEY`, `ONE_SECRET_KEY`, `ONE_WEBHOOK_SECRET`: WithOne integration.

## Local Development

```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd frontend
npm run dev
```

Vite proxies `/api/*` to `http://localhost:3001`.

## Verification

Frontend:

```bash
cd frontend
npm run typecheck
npm run build
```

Backend:

```bash
cd backend
npm run build
npm run db:validate
npm run db:verify:migration
```

Ingestion:

```bash
cd backend
npm run verify-ingestion
```

## Historical Terminology

| Old term | Current meaning |
|---|---|
| Track A | Historical direct-Supabase plan/reference. |
| Track B | Former name for the REST/Prisma/Azure implementation; now the active runtime. |
| `VITE_TRACK` | Retired frontend switch; current code uses REST repositories directly. |
| Supabase migrations | Reference-only schema context. |

## Current Implementation Validation

Validation date: 2026-06-19.

### Architecture Fit

Current implementation is best described as a modular layered monolith with explicit adapter seams:

```text
Presentation
  -> frontend routes/pages/components
  -> frontend hooks
  -> frontend REST repositories
  -> Express routes
  -> backend services / Prisma queries
  -> Azure PostgreSQL
```

This matches the intended REST/Prisma/Azure direction. The code does not use a live Supabase frontend runtime, and `backend/prisma/schema.prisma` is the canonical schema.

### Confirmed Strengths

- Runtime direction is coherent: `frontend/src/main.tsx` mounts QueryClient + RouterProvider, `frontend/src/router.tsx` declares lazy routes, `frontend/src/lib/repositories/rest-repositories.ts` maps repository calls to `/api/*`, and `backend/src/index.ts` serves the Express API.
- Frontend data access is mostly centralized behind repositories: `createRestRepositories()` returns the full `RepositoryFactory` in `frontend/src/lib/repositories/rest-repositories.ts:493`, and page/dashboard hooks consume that factory in `frontend/src/hooks/use-dashboard-data.ts:90` and `frontend/src/hooks/use-page-data.ts:56`.
- Backend owns Prisma access: `backend/src/lib/prisma.ts:23` creates the Prisma client, while frontend repository code only uses HTTP/fetch.
- Domain model direction is sound: `reservations` is the booking source of truth in `backend/prisma/schema.prisma:346`, while `guests` remains a compatibility surface in `backend/prisma/schema.prisma:167`.
- Provider-edge data is separated from core reservations: provider tables include `channels`, `external_accounts`, `channel_listings`, `reservation_external_refs`, and `provider_reservation_import_rows` in `backend/prisma/schema.prisma:238`, `backend/prisma/schema.prisma:252`, `backend/prisma/schema.prisma:277`, `backend/prisma/schema.prisma:384`, and `backend/prisma/schema.prisma:471`.
- Ingestion has a real contract boundary: `/api/ingest/*` validates dry-run/source/file shape before work in `backend/src/ingest/routes.ts:176` and dispatches executable modes in `backend/src/ingest/routes.ts:227`.
- Technical verification is healthy as of this validation: frontend typecheck passed, frontend tests passed 38/38, backend build passed, backend tests passed 232/232.

### Critical Findings

#### 1. Backend modularity is inconsistent

Newer domains are modularized as `routes/*` + `services/*`, for example tenants in `backend/src/routes/tenants.ts:11` delegating to `backend/src/services/tenant-service.ts:146`, and guest requests in `backend/src/routes/guest-requests.ts:29` delegating to `backend/src/services/guest-request-service.ts:114`.

However, `backend/src/index.ts` still contains many route handlers and domain logic directly: dashboard summary, reservations, occupancy stats, rooms, maintenance, channels, legacy guests, dining events, staff, security audit, rates, static serving, and server startup all live in one 1,300+ line file. Examples: dashboard summary starts at `backend/src/index.ts:417`, reservations at `backend/src/index.ts:626`, rooms at `backend/src/index.ts:920`, maintenance at `backend/src/index.ts:990`, and rates at `backend/src/index.ts:1265`.

Impact: the architecture is not yet a clean modular monolith. It works, but `backend/src/index.ts` is a coordination + domain + DTO + infrastructure hotspot.

Recommended direction: continue extracting route modules by domain, keeping service logic testable like tenants and guest requests.

#### 2. Repository boundary has one visible bypass

Project rule says only `frontend/src/lib/repositories/rest-repositories.ts` should construct API requests. Most code follows this, but `frontend/src/pages/settings/integrations-page.tsx` calls `fetch` directly in `submitForm()` and `runPipeline()` at `frontend/src/pages/settings/integrations-page.tsx:50` and `frontend/src/pages/settings/integrations-page.tsx:55`.

Impact: integration ingestion behavior is split between the page and repository layer. This weakens mocking, testability, API error normalization, and the stated frontend architecture rule.

Recommended direction: move these calls behind `IngestRepository` methods in `rest-repositories.ts`, then let the page use hooks/repository methods only.

#### 3. API contract typing is partly strong, partly loose

Frontend repository interfaces are explicit in `frontend/src/lib/repositories/types.ts:1`, and backend service-level domains use typed DTO helpers, for example tenant DTO masking in `backend/src/services/tenant-service.ts:70`.

But several backend route areas still use untyped dynamic Prisma filters via `any`: reservations at `backend/src/index.ts:712`, rooms at `backend/src/index.ts:925`, maintenance at `backend/src/index.ts:995`, external accounts at `backend/src/index.ts:1104`, legacy guests at `backend/src/index.ts:1135`, plus tax export filtering in `backend/src/tax-export/service.ts:268`.

Impact: this is not currently breaking typecheck, but it weakens the “contract-first” claim and makes query-shape regressions easier.

Recommended direction: replace route-local `any` filter objects with Prisma-generated `WhereInput` types when those routes are extracted.

#### 4. Error handling is not normalized across repository calls

Repository helpers differ: `getJson()` throws `Request failed (${status})`, while `postJson()`, `putJson()`, `patchJson()`, and `postForm()` throw raw `JSON.stringify(data)` from the API in `frontend/src/lib/repositories/rest-repositories.ts:57`, `frontend/src/lib/repositories/rest-repositories.ts:65`, `frontend/src/lib/repositories/rest-repositories.ts:78`, `frontend/src/lib/repositories/rest-repositories.ts:91`, and `frontend/src/lib/repositories/rest-repositories.ts:131`.

Impact: UI error messages and diagnostics vary by HTTP verb; consumers cannot rely on one error shape.

Recommended direction: introduce one small API error helper that preserves status, path, and parsed body.

#### 5. Production auth boundary is incomplete

The app has operationally sensitive surfaces: ingestion, integration connections, tenant identity docs, room passcodes in schema, tax export, staff, security audit. Current route-level auth is limited. For example, `/api/one/connections` only requires `x-user-id` in production in `backend/src/routes/one.ts:85`, auth-token is explicitly dev-gated/Sprint 2 in `backend/src/routes/one.ts:54`, and many core routes in `backend/src/index.ts` have no visible auth middleware.

Impact: acceptable for internal/dev staging only; not acceptable as a hardened production boundary without upstream auth/reverse-proxy controls.

Recommended direction: document the deployment auth boundary explicitly, or add Express middleware before exposing this beyond a trusted network.

#### 6. Environment validation reports missing required config but does not stop startup

`validateEnv()` returns `isValid: false` when `DATABASE_URL` is missing in `backend/src/config/env-validator.ts:79`, but `backend/src/index.ts:5` calls it without checking the return value. Startup continues and Prisma warm-up failure is logged but not fatal in `backend/src/index.ts:1341`.

Impact: local developer experience is forgiving, but production can boot into a broken API that only fails once routes hit the database.

Recommended direction: fail fast in production when required env is invalid; keep lenient behavior only for explicit local/test mode if needed.

### Overall Assessment

The active implementation is technically functional and directionally sound. It has a clear REST/Prisma/Azure architecture, real repository seams, a canonical Prisma schema, meaningful provider-edge tables, and good automated verification coverage.

Main weakness is architectural drift under growth: `backend/src/index.ts` remains too large, some frontend ingestion calls bypass repositories, and production boundary concerns are not fully encoded in the app. These are maintainability/security risks, not current build failures.

Priority order:

1. Decide and document production auth boundary.
2. Move direct integrations-page fetches into `IngestRepository`.
3. Extract remaining `backend/src/index.ts` route groups into route/service modules.
4. Normalize frontend API errors.
5. Replace route-local `any` Prisma filters with generated input types during extraction.
