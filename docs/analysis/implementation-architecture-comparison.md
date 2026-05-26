# Implementation Architecture Comparison

> Generated: 2026-05-25T01:08:15Z  
> Branch: `main` (uncommitted working-tree changes)  
> Scope: Performance-profiling optimization pass on Track B webapp

---

## Architecture Fields (Categories) Where Changes Were Applied

The optimization touched **five distinct architectural layers**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ARCHITECTURE LAYERS                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 1. BACKEND INSTRUMENTATION          backend/src/index.ts      │  │
│  │    - X-Response-Time header middleware                        │  │
│  │    - Slow-request logging (SLOW_REQUEST_THRESHOLD_MS)         │  │
│  │    - Prisma startup warm-up ($connect + SELECT 1)             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 2. BACKEND API CONTRACT             backend/src/index.ts      │  │
│  │    - New aggregate: GET /api/dashboard/summary                │  │
│  │    - Opt-in counts: include_count=true on list endpoints      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 3. FRONTEND REPOSITORY CONTRACT     src/lib/repositories/     │  │
│  │    - types.ts: DashboardSummary, DashboardRepository          │  │
│  │    - rest-repositories.ts: dashboardRepo.getSummary()         │  │
│  │    - query-keys.ts: dashboardKeys.summary(date)               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 4. FRONTEND DATA HOOK              src/hooks/                  │  │
│  │    - use-dashboard-data.ts: single useQuery replaces          │  │
│  │      7-query useQueries fanout + client-side derivation       │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 5. FRONTEND COMPOSITION            src/components/dashboard/  │  │
│  │    - dashboard-page.tsx: passes occupancySeries as prop       │  │
│  │    - occupancy-chart.tsx: removed self-fetching, props-only   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer-by-File Mapping

| Layer | File | Specific Changes |
|---|---|---|
| Backend Instrumentation | `backend/src/index.ts` | `X-Response-Time` middleware (L55-78), slow-request log, Prisma warm-up (L939-954) |
| Backend API Contract | `backend/src/index.ts` | `GET /api/dashboard/summary` endpoint (L314-519), `include_count=true` opt-in (L134-150) |
| Frontend Repository Contract | `src/lib/repositories/types.ts` | `DashboardSummary` interface, `DashboardRepository` interface, `dashboard` on `RepositoryFactory` |
| Frontend Repository Contract | `src/lib/repositories/rest-repositories.ts` | `dashboardRepo.getSummary(date, days, propertyId)` implementation |
| Frontend Repository Contract | `src/lib/query-keys.ts` | `dashboardKeys.summary(date)` cache key |
| Frontend Data Hook | `src/hooks/use-dashboard-data.ts` | Replaced `useQueries` (7 queries) with single `useQuery`; removed client-side derivation |
| Frontend Composition | `src/components/dashboard/dashboard-page.tsx` | Passes `occupancySeries` prop to chart |
| Frontend Composition | `src/components/dashboard/occupancy-chart.tsx` | Removed repository import, removed `useQuery`, accepts `data` + `today` props |

---

## Previous vs Current: Data Loading Comparison

### Previous Implementation (committed on `main`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  PREVIOUS: 7 parallel queries + 1 chart query = 8 HTTP requests     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  DashboardPage                                                      │
│    └─ useDashboardData(today)                                       │
│         └─ useQueries([                                             │
│              GET /api/properties           ─┐                       │
│              GET /api/rooms                 │                       │
│              GET /api/reservations          │  7 parallel            │
│              GET /api/guest-requests        ├─ HTTP requests         │
│              GET /api/maintenance           │  (~50-75ms each)       │
│              GET /api/reservations?check_in │                       │
│              GET /api/reservations?check_out┘                       │
│            ])                                                       │
│         └─ CLIENT-SIDE DERIVATION (useMemo):                        │
│              - maps reservations → Guest[] via toDashboardGuest()   │
│              - filters arrivals by status                           │
│              - filters departures by status                         │
│              - filters checkouts by status                          │
│              - computes PropertyMetrics[] per property              │
│              - computes totals (occupancy rate, counts)             │
│                                                                     │
│  OccupancyChart (SELF-FETCHING)                                     │
│    └─ useQuery(occupancyStats)                                      │
│         └─ GET /api/stats/occupancy?days=30  ← 8th HTTP request     │
│    └─ own property filter dropdown + state                          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  REFRESH MECHANISM:                                                 │
│    staleTime: 60,000ms (1 minute)                                   │
│    gcTime: 300,000ms (5 minutes)                                    │
│    refetchOnWindowFocus: false                                      │
│    retry: 1                                                         │
│    Clock tick: useVietnamClock refreshes `today` every 60s          │
│      → when `today` string changes (midnight), new query keys       │
│        trigger fresh fetches                                        │
│      → within the same day, staleTime governs refetch               │
│                                                                     │
│  TOTAL NETWORK: 8 requests, cumulative ~400-600ms with proxy hop    │
└─────────────────────────────────────────────────────────────────────┘
```

### Current Implementation (working tree)

```
┌─────────────────────────────────────────────────────────────────────┐
│  CURRENT: 1 aggregate query = 1 HTTP request                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  DashboardPage                                                      │
│    └─ useDashboardData(today)                                       │
│         └─ useQuery({                                               │
│              queryKey: ["dashboard", "summary", today],              │
│              queryFn: repos.dashboard.getSummary(today, 30)          │
│            })                                                       │
│              └─ GET /api/dashboard/summary?date=2026-05-25&days=30  │
│                                                                     │
│         └─ SERVER-SIDE DERIVATION (backend/src/index.ts):           │
│              - queries properties, rooms, reservations               │
│              - maps reservations → guests (same logic, server-side) │
│              - filters today arrivals/departures/checkouts           │
│              - computes PropertyMetrics[] per property               │
│              - computes totals                                       │
│              - queries occupancy series for `days` window            │
│              - returns full DashboardSummary bundle                  │
│                                                                     │
│         └─ CLIENT receives pre-computed data, destructures it       │
│                                                                     │
│  OccupancyChart (PROPS-DRIVEN)                                      │
│    └─ receives { data: OccupancySeriesPoint[], today: string }      │
│    └─ NO fetch, NO repository import, NO query                      │
│    └─ property filter dropdown REMOVED (simplified)                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  REFRESH MECHANISM (unchanged config, different behavior):          │
│    staleTime: 60,000ms (1 minute)                                   │
│    gcTime: 300,000ms (5 minutes)                                    │
│    refetchOnWindowFocus: false                                      │
│    retry: 1                                                         │
│    Clock tick: useVietnamClock refreshes `today` every 60s          │
│      → same midnight key-change behavior                            │
│      → BUT now only 1 query to refetch instead of 8                 │
│                                                                     │
│  TOTAL NETWORK: 1 request, 74-82ms warm (237ms avg with cold hit)  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Loading and Update Mechanism (Current)

### Does it load data?

Yes. On mount, `useDashboardData(today)` fires a single `useQuery` that calls:

```
GET /api/dashboard/summary?date=2026-05-25&days=30
```

Response time: **74-82ms warm**, 237ms average including cold first hit (555ms).

### Does it update/refresh data?

Yes, through three mechanisms:

| Mechanism | Trigger | Interval | What happens |
|---|---|---|---|
| **Stale time expiry** | TanStack Query marks data stale after `60,000ms` (1 minute) | 60s after last successful fetch | Next time the component re-renders or a query observer mounts, TanStack refetches in the background. The UI shows cached data until the fresh response arrives. |
| **Vietnam clock tick** | `useVietnamClock(60_000)` updates `today` every 60 seconds | 60s interval | If the date string changes (midnight crossover), the query key changes from `["dashboard","summary","2026-05-25"]` to `["dashboard","summary","2026-05-26"]`, which is a new cache entry and triggers an immediate fresh fetch. Within the same day, the key stays the same and stale-time governs. |
| **Component remount** | User navigates away and back to dashboard | on navigation | TanStack checks if cached data is stale (>60s old). If stale, refetches. If fresh, serves from cache instantly. |

### What does NOT trigger a refresh

- Window focus (`refetchOnWindowFocus: false`)
- There is no polling/`refetchInterval` configured
- There is no WebSocket or server-push mechanism

### Cache Lifecycle

```
t=0s     fetch fires → loading=true → response arrives → loading=false
t=0-60s  data is "fresh" → no refetch even on remount
t=60s+   data is "stale" → next render/mount triggers background refetch
t=300s   data is garbage-collected from memory if no active observer
```

### Configuration Source

All timing is set globally in `src/lib/query-client.ts`:

```typescript
export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,       // 1 minute before considered stale
        gcTime: 5 * 60_000,      // 5 minutes before garbage collection
        retry: 1,                // 1 retry on failure
        refetchOnWindowFocus: false,  // no tab-focus refetch
      },
    },
  });
}
```

The clock source is `src/hooks/use-vietnam-clock.ts`:

```typescript
export function useVietnamClock(refreshMs = 60_000) {
  // re-evaluates `today` (Vietnam timezone date string) every 60s
  // when `today` changes → query key changes → fresh fetch
}
```

---

## Side-by-Side Summary

| Dimension | Previous | Current |
|---|---|---|
| HTTP requests on dashboard load | 8 (7 parallel + 1 chart) | 1 |
| Where derivation happens | Client (`useMemo` chains) | Server (`/api/dashboard/summary` handler) |
| Occupancy chart data source | Own `useQuery` + repository | Props from parent |
| Property filter on chart | Yes (dropdown + per-property fetch) | Removed |
| Stale time | 60s (per query, 8 independent timers) | 60s (1 query, 1 timer) |
| Refetch cost | 8 requests x 50-75ms each | 1 request x 74-82ms |
| Cache key granularity | 7 independent keys + 1 chart key | 1 key: `["dashboard","summary", date]` |
| Cache invalidation | Can invalidate one resource independently | Must invalidate entire summary bundle |
| First-paint latency (warm) | Gated by slowest of 8 parallel requests | Gated by 1 request (~80ms) |
| First-paint latency (cold) | ~400-600ms cumulative with proxy | ~237ms average, 555ms worst case |
| Client CPU (derivation) | Filters + maps + metrics computation | Destructure only |
| Midnight rollover | 8 new cache entries, 8 fetches | 1 new cache entry, 1 fetch |
