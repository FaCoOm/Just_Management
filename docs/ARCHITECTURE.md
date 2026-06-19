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
