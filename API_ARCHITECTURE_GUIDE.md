# API & Architecture Guide (Track A + Track B)

This guide describes how the webapp is structured end-to-end, how the frontend talks to the backend, and how the Track B Express/Prisma API is implemented.

> Scope: This repo supports **two data tracks**:
> - **Track A**: Frontend reads Supabase directly.
> - **Track B**: Frontend calls an Express REST API; the backend uses Prisma against **Azure PostgreSQL Flexible Server**.

---

## 1) High-level architecture

### 1.1 Two-track data architecture

The UI is shared. Only the data access implementation changes.

```/dev/null/architecture.txt#L1-17
React (Vite) Frontend
  |
  |  chooses repository factory via VITE_TRACK
  |
  +--> Track A (default / VITE_TRACK=A)
  |      createSupabaseRepositories()
  |      -> @supabase/supabase-js -> Supabase Postgres
  |
  +--> Track B (VITE_TRACK=B)
         createRestRepositories()
         -> fetch(/api/...) -> Express backend
         -> Prisma Client -> Azure PostgreSQL Flexible Server
```

### 1.2 Real entry points (frontend)

Per `AGENTS.md`, the real frontend entry points are:

- `src/main.tsx` mounts `App` inside theme providers.
- `src/App.tsx` renders the shell (`SidebarProvider` + `AppSidebar`) and swaps pages.
- `src/components/dashboard/dashboard-page.tsx` is the main feature assembly point.
- `src/hooks/use-dashboard-data.ts` is the current “data contract” for the dashboard.

---

## 2) Frontend: data flow & repository layer

### 2.1 Repository abstraction

The repo defines interfaces in `src/lib/repositories/types.ts` and provides two implementations:

- `src/lib/repositories/supabase-repositories.ts` (Track A)
- `src/lib/repositories/rest-repositories.ts` (Track B)

The dashboard (and other pages) call **only the interfaces**, not Supabase or fetch directly.

### 2.2 Factory selection (Track A vs Track B)

The selection logic is in `src/hooks/use-dashboard-data.ts`:

- If `import.meta.env.VITE_TRACK === "B"` → use REST.
- Otherwise → use Supabase.

This makes switching environments a deployment-time concern, not a code change.

### 2.3 Track B REST client behavior

In `src/lib/repositories/rest-repositories.ts`:

- `VITE_TRACK_B_API_URL` provides the backend base URL.
- If unset, it defaults to `http://localhost:3001`.
- Each repository method calls an API route (`/api/properties`, `/api/rooms`, etc.) and returns JSON.

**Development proxy**: `vite.config.ts` proxies browser calls from Vite to the backend:

- Browser calls: `GET /api/...` (same origin as Vite)
- Vite proxies to: `http://localhost:3001/api/...`

This avoids CORS issues during local development.

### 2.4 Dashboard contract

`useDashboardData()` loads:

- `properties` via `repos.properties.getAll()`
- `rooms` via `repos.rooms.getAll()`
- `reservations` via `repos.reservations.getAll()`
- `requests` via `repos.guestRequests.getAll()`
- `maintenance` via `repos.maintenance.getAll()`

Then it derives:

- `guests` (compatibility view) from `reservations`
- `metrics` per property
- `totals` across properties

Important: The dashboard UI still consumes a `Guest`-shaped model for some panels, but that model is now derived from `reservations` for both tracks.

---

## 3) Backend (Track B): Express + Prisma implementation

### 3.1 Backend entry point

- Backend server: `backend/src/index.ts`
- Tech: Express, CORS, JSON middleware, Prisma Client

Core initialization:

- `const prisma = new PrismaClient();`
- `app.use(cors());`
- `app.use(express.json());`

### 3.2 Database connectivity (Azure)

Prisma reads the connection string from:

- `backend/prisma/schema.prisma` → `datasource db { url = env("DATABASE_URL") }`

So the backend’s runtime DB is controlled by:

- `backend/.env` → `DATABASE_URL=postgresql://...` (Azure PostgreSQL Flexible Server)

Supabase migrations under `supabase/migrations/` are **reference-only** and must not be applied to Azure.

### 3.3 API design

Current API is read-only (GET endpoints). It returns raw Prisma model rows.

#### Common query patterns

Endpoints use `req.query` to build a Prisma `where` filter. Current code uses `any` for the filter.

Example (reservations):
- Optional filters:
  - `property_id`
  - `status`
  - `start_date`, `end_date`

Then:
- `prisma.reservations.findMany({ where, orderBy: { check_in_date: "asc" } })`

### 3.4 Implemented endpoints (current)

#### Health
- `GET /health`
  - Returns `{ status: "ok", track: "B" }`

#### Properties
- `GET /api/properties`
  - Returns all properties ordered by name.

#### Rooms
- `GET /api/rooms?property_id=...`
  - Optional filter by `property_id`.

#### Reservations
- `GET /api/reservations`
  - Optional query params: `property_id`, `status`, `start_date`, `end_date`.
  - Date-range filtering currently sets:
    - `check_in_date >= new Date(start_date)`
    - `check_out_date <= new Date(end_date)`

- `GET /api/reservations/:id`
  - Returns a single reservation and includes:
    - `reservation_external_refs`
    - `reservation_room_allocations`

#### Maintenance
- `GET /api/maintenance?property_id=...&status=...`
  - Filters by property and/or status.

#### Guest requests
- `GET /api/guest-requests?property_id=...&guest_id=...&reservation_id=...`
  - Filters by the provided fields.

#### Guests (legacy)
- `GET /api/guests?property_id=...&room_id=...`
  - Exists for legacy compatibility; dashboard is primarily driven from `reservations`.

#### Channels & External Accounts
- `GET /api/channels`
  - Includes nested `external_accounts`.

- `GET /api/external-accounts?channel_id=...`
  - Optional filter by `channel_id`.

### 3.5 Backend implementation notes (current state)

#### Error handling
Most endpoints do not currently have try/catch blocks. If Prisma throws (e.g., connection error), Express will return a generic 500 and log the error.

Only `/api/reservations/:id` explicitly returns 404 when no row is found.

#### Validation
There is no request validation (Zod, yup, etc.) yet. Query parameters are treated as strings and inserted into `where` filters.

#### Types
`where` filters are typed as `any`. This is acceptable for scaffolding but makes the API easier to break as it evolves.

#### Security
- CORS is enabled globally with default settings.
- Auth is deferred to Sprint 2.

---

## 4) Database schema & migrations (Track B)

### 4.1 Canonical migration path

For Azure, the canonical schema is:

- `backend/prisma/schema.prisma`
- generated Prisma migration SQL under `backend/prisma/migrations/*/migration.sql`

A migration guard exists:

- `backend/scripts/verify-azure-migration.mjs`

It ensures:
- No Supabase-only RLS/roles appear in migration SQL.
- Required patterns exist (pgcrypto, `set_updated_at_timestamp()` trigger function).

### 4.2 Tables in the init migration

The init migration creates 15 tables mirroring Track A’s balanced-core v1 schema:

- `properties`, `rooms`, `reservations`, ...
- provider/channel mapping tables
- import staging and legacy backfill bridges

---

## 5) Environment configuration

### 5.1 Frontend env vars (Vite)

Defined in `src/env.d.ts`:

- `VITE_TRACK`: `"A"` or `"B"`
- `VITE_TRACK_B_API_URL`: backend base URL for Track B
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: Track A only

### 5.2 Backend env vars

- `DATABASE_URL`: Azure PostgreSQL connection string
- `PORT`: server port (defaults to 3001)

---

## 6) Practical “how to run” (Track B)

### 6.1 Backend

1. Set `backend/.env` with `DATABASE_URL` for Azure.
2. Deploy schema:
   - `npm run db:verify:migration`
   - `npm run db:deploy`
3. Start API:
   - `npm run dev`

### 6.2 Frontend

1. Set `.env` with:
   - `VITE_TRACK=B`
2. Run:
   - `npm run dev`

Vite proxy forwards `/api` calls to the backend in dev.

---

## 7) Suggested improvements (next hardening steps)

These are not required for Sprint 1 scaffolding, but will matter as Track B grows:

1. **Add structured error handling** (try/catch + consistent error payloads).
2. **Add request validation** for query params.
3. **Add pagination** for list endpoints.
4. **Normalize date filtering** for `@db.Date` fields.
5. **Add auth middleware** (Sprint 2: Clerk/Auth0) and restrict CORS.
6. **Introduce service layer** so endpoints aren’t direct Prisma calls.

---

## Appendix A: API endpoints quick reference

| Method | Endpoint | Query Params | Purpose |
|---|---|---|---|
| GET | `/health` | — | Health check |
| GET | `/api/properties` | — | Properties |
| GET | `/api/rooms` | `property_id` | Rooms |
| GET | `/api/reservations` | `property_id`, `status`, `start_date`, `end_date` | Reservations |
| GET | `/api/reservations/:id` | — | Reservation details |
| GET | `/api/maintenance` | `property_id`, `status` | Maintenance issues |
| GET | `/api/guest-requests` | `property_id`, `guest_id`, `reservation_id` | Guest requests |
| GET | `/api/guests` | `property_id`, `room_id` | Legacy guests |
| GET | `/api/channels` | — | Channels + accounts |
| GET | `/api/external-accounts` | `channel_id` | External accounts |
