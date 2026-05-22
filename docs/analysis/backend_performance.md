# Backend Performance Plan

> **Scope:** Track B only — Azure PostgreSQL source of truth.

---

## Current Bottleneck Shape

### 0. Cold Prisma connection to Azure PostgreSQL (biggest single factor)

`new PrismaClient()` uses **lazy connect** by default. The first request after backend start (or after the connection pool idle timeout) must:

1. Establish TCP connection to Azure (network latency from dev machine/server to Azure region)
2. Complete TLS handshake (`sslmode=require`)
3. Authenticate with PostgreSQL credentials

**Estimated cost:** 3–8 seconds depending on geographic distance to Azure region.

**Evidence:** [`backend/src/index.ts` L15](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/index.ts#L15) — `const prisma = new PrismaClient()` with no explicit `$connect()` call at startup.

**Why this matters:** The user-reported 5–10s load time happens on **first page load** after backend starts or after connection pool goes idle. Subsequent navigations within the same session are faster because the pool is warm and TanStack Query cache (`staleTime: 60_000`) serves stale data.

**Fix:** Add `prisma.$connect()` at backend startup to pre-warm the pool before any HTTP request arrives.

### 1. Every page uses the same heavy dashboard hook

`useDashboardData()` fires **7 parallel queries** on every page that uses it:

- `/api/properties`
- `/api/rooms`
- `/api/reservations`
- `/api/guest-requests`
- `/api/maintenance`
- `/api/reservations?check_in_date=today`
- `/api/reservations?check_out_date=today`

**Evidence:** [`use-dashboard-data.ts` L109–L142](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/hooks/use-dashboard-data.ts#L109-L142)

**Used by:**

- [`dashboard-page.tsx` L34–L47](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/components/dashboard/dashboard-page.tsx#L34-L47)
- [`reservations-page.tsx` L242](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/components/reservations/reservations-page.tsx#L242)
- [`guests-page.tsx` L200](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/components/guests/guests-page.tsx#L200)
- [`rooms-page.tsx` L74](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/components/rooms/rooms-page.tsx#L74)
- [`maintenance-page.tsx` L235](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/components/maintenance/maintenance-page.tsx#L235)

**Meaning:** opening Rooms still downloads reservations, guest requests, maintenance, arrivals, departures. Opening Maintenance still downloads all rooms/reservations/derived guest rows.

### 2. Backend endpoints return full tables, no pagination

**Examples:**

- **`/api/reservations`** ([`index.ts` L115–L167](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/index.ts#L115-L167)) — uses `findMany()` with no `take`, no field select, no pagination.
- **`/api/rooms`** ([`index.ts` L283–L288](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/index.ts#L283-L288)) — returns all matching rooms.
- **`/api/maintenance`** ([`index.ts` L294–L304](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/index.ts#L294-L304)) — returns all matching issues.
- **`/api/guest-requests`** ([`index.ts` L326–L337](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/index.ts#L326-L337)) — returns all matching requests.
- **`/api/guests`** ([`index.ts` L343–L353](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/index.ts#L343-L353)) — returns all legacy guests.

This is fine for seed data. Slow for real Azure DB + growing hotel data.

> **Correction:** `/api/reservations` does use Prisma `select` (specific field selection). The issue is not missing field selection but missing **default pagination** — the endpoint returns all matching rows when called without `limit`/`offset`.

**Additionally:** Each endpoint runs a parallel `prisma.*.count({ where })` alongside `findMany` even when the frontend `getAll()` never uses pagination and ignores `X-Total-Count`. This **doubles the queries** sent to Azure PG per request.

### 2b. OccupancyChart creates a serial 8th query waterfall

The `OccupancyChart` component ([`occupancy-chart.tsx` L75–L83](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/components/dashboard/occupancy-chart.tsx#L75-L83)) has its own `useQuery` that fires **after** the dashboard skeleton resolves (because it depends on `properties` being loaded first).

This creates a sequential waterfall:

```
7 parallel queries → wait → render dashboard → OccupancyChart mounts → 8th query → re-render
```

**Cost:** Additional 200–500ms after initial dashboard render completes.

### 3. Dashboard metrics computed client-side from full datasets

`useDashboardData()` fetches full reservations, maps all into legacy guest rows, then filters and computes metrics in browser.

**Evidence:**

- **Full reservations query:** [`use-dashboard-data.ts` L121–L124](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/hooks/use-dashboard-data.ts#L121-L124)
- **Map all reservations into guests:** [`use-dashboard-data.ts` L154](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/hooks/use-dashboard-data.ts#L154)
- **Per-property repeated filters:** [`use-dashboard-data.ts` L182–L219](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/hooks/use-dashboard-data.ts#L182-L219)
- **Totals re-filter rooms by property:** [`use-dashboard-data.ts` L221–L241](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/hooks/use-dashboard-data.ts#L221-L241)

**Better:** backend should return a dashboard summary DTO from PostgreSQL aggregates.

### 4. No route-level code splitting

Router imports every page up front:
[`router.tsx` L1–L9](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/router.tsx#L1-L9)

Routes use direct component refs:
[`router.tsx` L25–L53](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/router.tsx#L25-L53)

So first load pulls dashboard + reservations + guests + rooms + maintenance pages, plus table/chart code.

### 5. Query cache exists but is too generic

Current Query config ([`query-client.ts` L3–L14](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/lib/query-client.ts#L3-L14)):

```ts
staleTime: 60_000
gcTime: 5 * 60_000
retry: 1
refetchOnWindowFocus: false
```

Good baseline, but not tuned by data volatility. Properties/rooms can be cached much longer than active reservations/maintenance.

### 6. Vite proxy adds overhead in development mode

In dev, all `/api` calls route through Vite's built-in proxy ([`vite.config.ts` L17–L21](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/vite.config.ts#L17-L21)):

```ts
proxy: {
  "/api": {
    target: "http://localhost:3001",
    changeOrigin: true,
  },
}
```

**Cost:** ~50–100ms per request × 7–8 requests = 350–800ms added latency in dev only.

**Not relevant in production build**, but explains why `npm run dev` feels worse than expected.

### 7. API URL always defaults to absolute localhost

Track B repository does ([`rest-repositories.ts` L21–L24](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/lib/repositories/rest-repositories.ts#L21-L24)):

```ts
const base = import.meta.env.VITE_TRACK_B_API_URL ?? "http://localhost:3001";
return `${base}${path}`;
```

In deployed frontend, absolute cross-origin API can add CORS/preflight/network distance cost. If same-origin deployment is possible, relative `/api` is better. If separate Azure services, keep explicit backend URL but enable compression/cache and measure latency.

### 8. No connection pool warm-up or keep-alive strategy

Default Prisma pool settings:

- `connection_limit` defaults to `num_cpus * 2 + 1` (usually 5–9)
- Lazy connect: first query pays connection cost
- Pool idle timeout: connections drop after inactivity

**Current code:** No `$connect()` at startup, no periodic health-check query to keep the pool warm.

**Effect:** After ~5 minutes of no traffic, the pool connections close. Next user visit pays the full cold-connect penalty again.

---

## Latency Budget Summary (First Load)

| Factor | Estimated Cost | Occurrence |
|--------|---------------|------------|
| Azure PG cold connect (TCP + TLS + auth) | 3–8s | First request or after idle |
| 7 parallel queries × Azure round-trip | 200–500ms each | Every page load |
| Redundant `count()` queries | 100–300ms total | Every page load |
| Vite proxy overhead (dev only) | ~50ms × 7 | Every request in dev |
| OccupancyChart serial 8th query | 200–500ms | After dashboard renders |
| No pagination (full table scans) | Grows with data | Every page load |
| **Total first-load** | **5–10s** | Matches user-reported observation |

**Subsequent navigation (warm pool + cache):** ~1–2s (cache hits + warm connections).

---

## Reflection on the Previous Implementation

The previous implementation was directionally useful but did **not** target the largest root causes, so it should not be expected to create a major perceived speedup on first load.

### What changed

1. **Route-level code splitting was added.**
   - `src/router.tsx` now uses `lazyRouteComponent`, and production build output shows separate route chunks.
   - This reduces initial JavaScript work for non-current pages.
   - It does **not** reduce backend/API latency for the dashboard itself.

2. **Non-dashboard pages stopped using the full dashboard hook.**
   - `src/hooks/use-page-data.ts` introduced narrower hooks for Reservations, Guests, Rooms, and Maintenance.
   - This reduces obvious overfetching on secondary routes.
   - It does **not** materially improve the initial dashboard route, which still uses `useDashboardData()` and still fires the dashboard query set.

3. **Backend endpoints received optional pagination, field projection, cache headers, compression, and additive indexes.**
   - Optional `limit`/`offset` only helps callers that pass those parameters.
   - Current frontend `getAll()` calls still request unpaginated arrays.
   - The backend also now runs `count()` alongside several list queries to set `X-Total-Count`; when the caller does not use this header, this can add extra Azure PostgreSQL work instead of reducing it.

4. **Migration verification was improved for additive migrations.**
   - The guard now validates banned Supabase patterns across all migrations and checks required Track B init features across migration history.
   - This is correctness/safety work, not runtime performance work.

### Why the perceived performance barely changed

The highest-latency path is still unchanged:

```text
frontend dashboard mount
→ 7 dashboard API requests
→ first backend request lazily opens Prisma/Azure PostgreSQL connection if cold
→ multiple Azure round trips
→ client maps/filter/reduces full reservation and room datasets
→ OccupancyChart fires an additional stats query after mount
```

The previous implementation mostly optimized around this path rather than replacing it. It improved route bundle shape and some secondary route fetches, but it did not remove the cold Prisma connect cost, did not collapse the dashboard waterfall into one backend summary endpoint, and did not make the frontend use paginated APIs.

### Corrections to the prior implementation strategy

- **Do not count rows by default for unpaginated `getAll()` endpoints.** If the UI does not request pagination metadata, avoid `count()` because it doubles database work.
- **Make pagination explicit in repository contracts.** Optional API pagination is insufficient if frontend repositories keep calling `getAll()`.
- **Move dashboard aggregation server-side before adding more micro-optimizations.** The dashboard needs one purpose-built endpoint returning KPI totals, per-property metrics, today arrivals/departures/checkouts, maintenance counts, and occupancy data.
- **Pre-warm Prisma at startup.** Cold connect remains the most likely reason for 5–10s first-load delay against Azure PostgreSQL.
- **Measure before adding more indexes.** The additive indexes are plausible, but Azure Query Store / `EXPLAIN ANALYZE` should confirm benefit on real data.

### Revised next high-impact sequence

1. Add backend startup connection warm-up with `await prisma.$connect()` before `app.listen()` reports readiness.
2. Add lightweight request timing and Prisma query timing logs to prove where first-load time is spent.
3. Add `GET /api/dashboard/summary?date=YYYY-MM-DD&property_id=` and make the dashboard load that summary instead of seven independent calls.
4. Move `OccupancyChart` data into that summary response, or prefetch it in the same hook so it is not a serial post-render query.
5. Replace frontend `getAll()` usage on large lists with paginated repository methods and make row counts opt-in.
6. Re-run browser Network + backend timing comparison before/after each phase.

---

## Plan to Move Project Onward

### Phase 1 — Measure before changing

**Goal:** know whether bottleneck is network, DB query, JSON payload, JS bundle, or render.

Add temporary/permanent observability:

1. **Backend request timing middleware:**
   - method
   - path
   - status
   - duration ms
   - response size if feasible
2. **Prisma query logging** in non-production or sampled production:
   - query duration
   - route correlation if possible
3. **Frontend lightweight timings:**
   - page load start/end
   - query durations from TanStack Query Devtools / manual logs during diagnosis
4. **Browser check:**
   - Network tab: waterfall count, payload sizes
   - Performance tab: JS parse/render time
   - Vite production build size

**Pass/fail:**

- Know slowest endpoints
- Know largest payloads
- Know initial JS bundle/chunks
- Know whether route navigation refetches stale data

No schema/data behavior change yet.

### Phase 2 — Stop every page from loading dashboard universe

Split current all-purpose hook into page-specific hooks/repositories.

**Likely new hooks:**

- `useDashboardSummary(today)`
- `useReservationsPageData(filters, pagination)`
- `useGuestsPageData(filters, pagination)`
- `useRoomsPageData(propertyId)`
- `useMaintenancePageData(filters, pagination)`

Keep dashboard folder rule: panels stay props-driven; fetching stays in hooks.

**Change direction:**

- **Dashboard page** needs summary + limited recent rows.
- **Reservations page** needs reservations page data + properties/rooms lookup.
- **Rooms page** needs rooms + properties + maybe active guest count, not all reservations.
- **Maintenance page** needs maintenance + properties/rooms.
- **Guests page** currently legacy-compatible guests derived from reservations; better endpoint should return only rows needed by guest page.

**Files likely touched later:**

- [`use-dashboard-data.ts`](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/hooks/use-dashboard-data.ts)
- [`query-keys.ts`](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/lib/query-keys.ts)
- [`rest-repositories.ts`](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/lib/repositories/rest-repositories.ts)
- [`types.ts`](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/src/lib/repositories/types.ts)
- Page components using `useDashboardData()`

**Expected gain:** fewer requests, smaller payload, less client compute on page navigation.

### Phase 3 — Add Track B dashboard aggregation endpoint

Add backend endpoint:

```
GET /api/dashboard/summary?date=YYYY-MM-DD&property_id=
```

**Return shaped data:**

```jsonc
{
  "properties": [],
  "totals": {},
  "metricsByProperty": {},
  "todayArrivals": [],
  "todayDepartures": [],
  "todayCheckouts": [],
  "openMaintenanceSummary": {},
  "recentArrivals": [],
  "occupancySeries": [] // or separate endpoint
}
```

Backend should use Prisma `count`, `groupBy`, filtered `findMany`, and `select`.

**Why:** current dashboard asks for full properties, rooms, reservations, guest requests, maintenance, arrivals, departures, then computes in browser. Azure Gateway Aggregation pattern supports merging multiple backend calls into one request to reduce chattiness, but keep it dashboard-specific to avoid mega-endpoint coupling.

**Use exact Track B source:**

- Express owns Prisma access.
- PostgreSQL/Azure remains source.
- Supabase stays reference-only, not runtime.

**Likely location:**

- Either focused module under `backend/src/dashboard/`
- Or initially inside [`backend/src/index.ts`](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/index.ts), then split if file grows.

**Expected gain:** biggest initial dashboard load improvement.

### Phase 4 — Add pagination + field selection

Current table routes return full rows. Add query params:

| Param | Purpose |
|---|---|
| `limit` | Page size |
| `cursor` or `offset` | Position |
| `sort` | Sort column/direction |
| `status` | Status filter |
| `property_id` | Property scope |
| `start_date` | Date range start |
| `end_date` | Date range end |
| `search` | Free-text search |

**Return shape:**

```jsonc
{
  "rows": [],      // T[]
  "rowCount": 0,   // optional total
  "nextCursor": "" // optional for cursor pagination
}
```

**Frontend** — TanStack Table can use:

- `manualPagination: true`
- Query key includes filters/sort/page
- `placeholderData` / keep previous page behavior

**Backend** — Prisma:

- Use `take`
- Use `skip` only for shallow page navigation
- Use `cursor` for large reservation feeds
- Use `select` to return only columns shown by table

**Prisma docs support:**

- `select` to reduce fetched fields
- `skip`/`take` and cursor pagination
- `aggregate`/`groupBy` for counts

**Expected gain:** prevents page load growing linearly with database size.

### Phase 5 — Add missing indexes for actual query patterns

**Current schema has some indexes:**

- `reservations`: `@@index([property_id, check_in_date, check_out_date])` — [`schema.prisma` L235](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/prisma/schema.prisma#L235)
- `reservations`: `@@index([status])` — [`schema.prisma` L236](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/prisma/schema.prisma#L236)
- Guest requests: property/reservation indexes present
- Provider import indexes present

**Missing or likely needed based on current API:**

```prisma
// rooms: /api/rooms?property_id=...
@@index([property_id])

// guests: /api/guests?property_id=...&room_id=... orderBy created_at desc
@@index([property_id, created_at])
@@index([room_id, created_at])

// maintenance: /api/maintenance?property_id=...&status=... orderBy created_at desc
@@index([property_id, status, created_at])
@@index([status, created_at])

// reservations: /api/reservations?check_in_date=...
@@index([check_in_date])
@@index([check_out_date])

// reservations: dashboard/date/status/property combinations
@@index([property_id, status, check_in_date])
@@index([property_id, status, check_out_date])
```

> **Note:** confirm with `EXPLAIN ANALYZE` against real Azure data before finalizing every index. Too many indexes slow writes/imports.

**Migration path:**

1. Update [`schema.prisma`](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/prisma/schema.prisma)
2. Add new Prisma migration under [`backend/prisma/migrations`](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/prisma/migrations)
3. Run `db:generate`, `db:validate`, `db:verify:migration`

**Expected gain:** faster filtered/sorted endpoints as data grows.

### Phase 6 — Route-level code splitting

Use TanStack Router lazy route components. Current router imports all page modules at startup. Replace direct imports with lazy route imports.

**Docs pattern:**

```ts
import { lazyRouteComponent } from "@tanstack/react-router"

const reservationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reservations",
  component: lazyRouteComponent(
    () => import("@/components/reservations/reservations-page"),
    "ReservationsPage"
  ),
})
```

Also consider lazy loading heavy dashboard panels/charts after route-level split.

> Do not split tiny primitives. Do not split loaders unnecessarily; TanStack docs warn loader split can create double async cost.

**Expected gain:** faster first paint, less JS parse/execute on initial route.

### Phase 7 — Router preload + Query cache coordination

Use TanStack Router loaders to seed Query cache.

**Plan:**

1. **Create query option factories:**
   - `dashboardSummaryQueryOptions(date)`
   - `reservationsQueryOptions(filters)`
   - `propertiesQueryOptions()`
   - `roomsQueryOptions(propertyId?)`
2. **Router context** includes `queryClient`.
3. **Route loader:**
   ```ts
   loader: ({ context: { queryClient } }) =>
     queryClient.ensureQueryData(dashboardSummaryQueryOptions(date))
   ```
4. **Router config:**
   - `defaultPreload: "intent"`
   - `defaultPreloadStaleTime: 0` — so TanStack Query owns freshness

**Expected gain:** route hover/click preloads data; route mount mostly reads cached data.

### Phase 8 — Backend response/network polish

Small but useful:

- **Compression** — add middleware for JSON responses.
- **Cache headers / ETag** for stable reference endpoints:
  - `/api/properties`
  - `/api/rooms` (if room data changes rarely)
  - `/api/channels`
- **Short stale cache** for operational endpoints only, if any.
- **Select DTOs** to prevent oversized JSON.
- **Review deployment topology:**
  - Frontend and API in same Azure region
  - Azure PostgreSQL same region as API
  - `DATABASE_URL` has required `sslmode=require`
  - Consider connection pool settings or PgBouncer / Prisma Accelerate only if connection pressure observed

**Expected gain:** lower transfer time, fewer redundant bytes.

---

## Recommended Execution Order

1. Measure endpoint times / payloads / bundle.
2. Create page-specific data hooks so pages stop loading unrelated datasets.
3. Add `/api/dashboard/summary` and move dashboard aggregation server-side.
4. Add pagination / select DTOs for reservation/guest/maintenance tables.
5. Add confirmed indexes through Prisma migration.
6. Lazy split routes in TanStack Router.
7. Add preload/loaders for route data.
8. Compression / cache headers / deployment tuning.

This order gives biggest risk-adjusted wins first and keeps Track B clean:
**React → REST repositories → Express → Prisma → Azure PostgreSQL.** No Supabase runtime revival.

---

## Verification Plan After Implementation

### Frontend

```bash
npm run typecheck
npm run build
```

### Backend

```bash
cd backend
npm run build
npm run db:generate
npm run db:validate
npm run db:verify:migration
```

### Manual QA

1. Run backend + frontend:
   ```bash
   npm run dev:all
   ```
2. Open dashboard.
3. **Browser Network:**
   - Compare request count before/after
   - Compare total transferred bytes
   - Compare slowest endpoint
4. **Navigate** each route:
   - `/`
   - `/reservations`
   - `/guests`
   - `/rooms`
   - `/maintenance`
5. Confirm each route no longer triggers unrelated full-table fetches.
6. Confirm dashboard numbers still match prior semantics.
