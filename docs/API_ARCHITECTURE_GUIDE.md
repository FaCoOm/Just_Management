# API & Architecture Guide (Current REST Runtime)

This guide describes the current Just Management webapp runtime: React + REST repositories on the frontend, Express routes on the backend, Prisma for data access, and Azure PostgreSQL as the database target.

> Historical note: earlier docs used Track A for direct Supabase and Track B for REST/Prisma/Azure. The active repo is now REST/Prisma/Azure-only. Supabase SQL remains reference-only schema context.

---

## 1) High-level architecture

```text
React (Vite) Frontend
  -> createRestRepositories()
  -> fetch(/api/...)
  -> Express backend
  -> Prisma Client
  -> Azure PostgreSQL Flexible Server
```

### 1.1 Real entry points

- `frontend/src/main.tsx` mounts React, TanStack Query, theme provider, and TanStack Router.
- `frontend/src/router.tsx` defines the lazy route tree.
- `frontend/src/components/dashboard/dashboard-page.tsx` assembles dashboard panels.
- `frontend/src/hooks/use-dashboard-data.ts` is the dashboard data contract and calls `createRestRepositories()`.
- `frontend/src/lib/repositories/rest-repositories.ts` constructs API requests.
- `backend/src/index.ts` registers Express middleware, routes, dashboard summary, stats, ingestion, One, and tax-export endpoints.
- `backend/prisma/schema.prisma` is the canonical schema source.

---

## 2) Frontend data flow

### 2.1 Repository abstraction

The frontend defines repository contracts in `frontend/src/lib/repositories/types.ts` and implements them in `frontend/src/lib/repositories/rest-repositories.ts`.

Hooks and pages consume repository interfaces only. They do not call `fetch` directly and do not import backend or Prisma internals.

### 2.2 REST client behavior

`frontend/src/lib/repositories/rest-repositories.ts`:

- Reads `VITE_TRACK_B_API_URL` as an optional backend origin.
- Uses same-origin paths when that value is empty.
- Calls API routes such as `/api/properties`, `/api/rooms`, `/api/reservations`, `/api/dashboard/summary`.
- Throws on non-2xx responses.

### 2.3 Development proxy

`frontend/vite.config.ts` proxies `/api/*` to `http://localhost:3001` during local development.

This keeps browser calls same-origin under Vite while the backend runs separately.

### 2.4 Dashboard contract

`useDashboardData()` loads the dashboard summary through `repos.dashboard.getSummary(today, 30)` and returns:

- `properties`
- `rooms`
- `reservations`
- `guests` compatibility view
- `requests`
- `maintenance`
- `metrics`
- `todayArrivals`
- `todayDepartures`
- `todayCheckouts`
- `totals`
- `occupancySeries`

Important: `reservations` is the booking source of truth. `guests` remains a compatibility shape for older guest-labeled UI.

---

## 3) Backend: Express + Prisma

### 3.1 Backend entry point

- Server: `backend/src/index.ts`
- Tech: Express, CORS, JSON middleware, compression, Prisma Client
- Startup warms Prisma with `$connect()` and `SELECT 1` before logging readiness.

### 3.2 Database connectivity

Prisma reads the connection string from `DATABASE_URL` in `backend/.env`:

```text
postgresql://USER:PASSWORD@HOST.postgres.database.azure.com:5432/m_management?sslmode=require
```

`supabase/migrations/` files are reference-only and must not be applied to Azure.

### 3.3 API design

Routes parse query/body values in the backend, call Prisma, and return frontend DTOs aligned with `frontend/src/lib/repositories/types.ts`.

Common route groups:

- Dashboard summary and occupancy stats
- Properties, rooms, reservations, guest requests, guests, maintenance
- Dining events, rates, staff, security audits
- Channels and external accounts
- Ingestion and provider sync
- One/WithOne integrations
- Tax export preview, run, review, download

---

## 4) Database schema and migrations

Canonical Azure schema path:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/*/migration.sql`

Migration guard:

- `backend/scripts/verify-azure-migration.mjs`

It checks that deployable migrations avoid Supabase-only roles/RLS and include required PostgreSQL features such as `pgcrypto` and the update-timestamp trigger function.

---

## 5) Environment configuration

### Frontend env vars

Defined in `frontend/src/env.d.ts` and root `.env.example`:

- `VITE_TRACK_B_API_URL`: optional backend base URL. Empty means same-origin/proxied API calls.
- `VITE_ONE_AUTH_TOKEN_URL`: backend route for WithOne Connect AuthKit tokens.

### Backend env vars

- `DATABASE_URL`: Azure PostgreSQL connection string.
- `PORT`: server port, default `3001`.
- `ALLOWED_ORIGINS`: optional comma-separated CORS allowlist.
- `ONE_CONNECTION_KEY`, `ONE_SECRET_KEY`, `ONE_WEBHOOK_SECRET`: WithOne integration values.

---

## 6) How to run

### Backend

```bash
cd backend
npm install
npm run db:generate
npm run db:validate
npm run db:verify:migration
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` calls to the backend in dev.

---

## 7) API endpoints quick reference

| Method | Endpoint | Query Params | Purpose |
|---|---|---|---|
| GET | `/health` | - | Health check |
| GET | `/api/dashboard/summary` | `date`, `days`, `property_id` | Dashboard aggregate payload |
| GET | `/api/stats/occupancy` | `days`, `end_date`, `property_id` | Occupancy series |
| GET | `/api/properties` | - | Properties |
| GET | `/api/rooms` | `property_id` | Rooms |
| PATCH | `/api/rooms/:id/status` | - | Room status update |
| GET | `/api/reservations` | `property_id`, `status`, `start_date`, `end_date` | Reservations |
| POST | `/api/reservations` | - | Create reservation |
| GET | `/api/reservations/:id` | - | Reservation details |
| GET | `/api/maintenance` | `property_id`, `status` | Maintenance issues |
| POST | `/api/maintenance` | - | Create maintenance issue |
| GET | `/api/guest-requests` | `property_id`, `guest_id`, `reservation_id` | Guest requests |
| GET | `/api/guests` | `property_id`, `room_id` | Legacy guests |
| GET | `/api/channels` | - | Channels + accounts |
| GET | `/api/external-accounts` | `channel_id` | External accounts |
| GET | `/api/integrations/status` | - | WithOne status |
| GET/POST | `/api/ingest/*` | varies | Ingestion operations |
| GET/POST/PATCH | `/api/tax-export/*` | varies | Tax export operations |

---

## 8) Historical terminology

| Old term | Current meaning |
|---|---|
| Track A | Historical direct-Supabase approach; reference only. |
| Track B | Former name for the REST/Prisma/Azure implementation; now the active runtime. |
| `VITE_TRACK` | Retired switch. Current frontend uses REST repositories directly. |
| `supabase/migrations/` | Schema-intent reference; not an Azure deployment path. |
