# Performance Profiling Report - 2026-05-22

## Scope
This report consolidates the performance-profiling work carried out against the current Track B webapp: React 19 + Vite frontend, Express + Prisma backend, and repository-driven dashboard data access. It records the commands run, observed timings, browser/network evidence, implemented performance changes, current file locations, and remaining profiling gaps.

## Where The Findings Are
- `docs/analysis/backend_performance.md` contains the original backend-focused performance analysis, baseline endpoint timings, asset sizes, bottleneck list, and implementation update.
- `docs/analysis/TRACK_B_BACKEND_ANALYSIS.md` contains the backend analysis addendum documenting the 2026-05-22 profiling slice.
- `docs/analysis/PERFORMANCE_PROFILING_REPORT_2026-05-22.md` is this consolidated report.

## Team-Mode State
Two inline team-mode runs were used earlier and then deleted after their phases completed:

| Team | Purpose | Status |
|---|---|---|
| `track-b-backend-performance-team` | backend performance analysis | deleted |
| `track-b-performance-implementation-team` | performance implementation review/support | deleted |

No persistent team config was written. `team_list(scope="all")` returned an empty list, and `C:\Users\Fate_Conqueror\.omo\teams` / `C:\Users\Fate_Conqueror\.omo\runtime` were empty after deletion. The project-root `.omo/` directory is a local orchestration artifact and remains untracked.

## Profiling Commands And Evidence

### Build Timing
Measured with PowerShell stopwatch wrappers around the normal repo commands.

| Check | Observed result |
|---|---:|
| Frontend production build | `10512ms` fresh rerun, earlier baseline `12698ms` |
| Backend TypeScript build | `6575ms` fresh rerun, earlier baseline `6578ms` |
| Prisma validation | passed |
| Migration verification | passed earlier: 3 migrations, 17 `CREATE TABLE` statements |

Verification commands already run during the implementation pass:

```bash
npm run typecheck
npm run build
cd backend; npm run build
cd backend; npm run db:validate
```

`git diff --check` reported only existing CRLF warnings during the prior verification pass.

### API Endpoint Timing
Backend and Vite preview were started locally. API probes were run against `http://localhost:3001` using three samples per endpoint.

| Endpoint | Average | Samples | Bytes | Notes |
|---|---:|---|---:|---|
| `/api/dashboard/summary?date=2026-05-22` | `237ms` | `555, 82, 74` | `707` | first hit includes warm path overhead |
| `/api/properties` | `53.7ms` | `78, 43, 40` | `2` | local empty-data response |
| `/api/rooms` | `57.3ms` | `78, 46, 48` | `2` | local empty-data response |
| `/api/reservations` | `61.3ms` | `99, 41, 44` | `2` | no count header by default |
| `/api/reservations?include_count=true` | `55.3ms` | `87, 40, 39` | `2` | `X-Total-Count: 0` observed |
| `/api/stats/occupancy?days=7&end_date=2026-05-22` | `73.7ms` | `76, 71, 74` | `449` | compatibility endpoint still works |

The important behavioral finding is that dashboard loading now has a single summary endpoint available instead of relying on a seven-request dashboard fanout.

### Browser And Network Profiling
Playwright browser verification was run against `http://127.0.0.1:4173/`.

Observed page title:

```text
Latte Lounge - Portfolio Dashboard
```

Observed API network request:

```text
GET http://localhost:3001/api/dashboard/summary?date=2026-05-22&days=30 => 200 OK
```

Browser performance timing:

| Metric | Observed value |
|---|---:|
| Navigation duration | `65ms` |
| DOMContentLoaded | `65ms` |
| Load event end | `65ms` |
| Document transfer size | `824` bytes |
| Dashboard summary fetch duration | `125ms` |

Console status:

| Type | Count | Notes |
|---|---:|---|
| Errors | `0` | none observed |
| Warnings | `12` | Google Fonts decode / OTS parsing warnings for `Plus Jakarta Sans` and `Newsreader` |

Largest browser resource timings observed through the browser resource timing API:

| Resource | Transfer size | Duration |
|---|---:|---:|
| `/assets/index-Btner2W9.js` | `144444` | `31ms` |
| `/assets/dashboard-page-B3oZYIQV.js` | `121311` | `30ms` |
| `/assets/index-DR5IapHy.css` | `20023` | `13ms` |
| `/assets/use-dashboard-data-CJtjp-pK.js` | `5387` | `13ms` |
| `/assets/table-evfG7TDb.js` | `1541` | `13ms` |

### Production Asset Sizes
From the Vite production output:

| Asset | Size |
|---|---:|
| `index-Btner2W9.js` | `456,515` bytes |
| `dashboard-page-B3oZYIQV.js` | `410,300` bytes |
| `index-DR5IapHy.css` | `128,343` bytes |
| `index-BtPgsCOV.js` | `50,527` bytes |
| `select-t3xoRHAj.js` | `21,612` bytes |
| `use-dashboard-data-CJtjp-pK.js` | `14,407` bytes |

The largest remaining frontend risk is bundle weight, especially the main app chunk and dashboard page chunk. The current repo does not include a bundle analyzer artifact, so the sizes are measured but not yet attributed to specific modules.

## Implemented Performance Changes

### Backend
File: `backend/src/index.ts`

- Added request timing middleware that emits `X-Response-Time`.
- Added slow request logging controlled by `SLOW_REQUEST_THRESHOLD_MS`.
- Changed list endpoint count behavior to opt-in via `include_count=true` / `includeCount=true`.
- Added `GET /api/dashboard/summary?date=YYYY-MM-DD&days=30&property_id=`.
- Added Prisma startup warm-up with `prisma.$connect()` and `SELECT 1` before readiness is reported.

### Frontend Repository Contract
Files:

- `src/lib/repositories/types.ts`
- `src/lib/repositories/rest-repositories.ts`
- `src/lib/query-keys.ts`

Changes:

- Added `DashboardSummary`.
- Added `DashboardRepository`.
- Added `dashboard` to `RepositoryFactory`.
- Added `dashboardRepo.getSummary(date, days, propertyId)`.
- Added `dashboardKeys.summary(date)`.

### Dashboard Data Flow
Files:

- `src/hooks/use-dashboard-data.ts`
- `src/components/dashboard/dashboard-page.tsx`
- `src/components/dashboard/occupancy-chart.tsx`

Changes:

- Replaced multi-query dashboard fanout with one `repos.dashboard.getSummary(today, 30)` query.
- Passed `occupancySeries` from the dashboard page into the chart.
- Removed repository access and internal TanStack Query usage from `OccupancyChart`.

## Before And After Shape

| Area | Before | After |
|---|---|---|
| Dashboard data loading | multiple repository queries plus chart-level occupancy query | one dashboard summary query for the page |
| Occupancy chart | fetched its own occupancy data | receives data from parent props |
| List counts | count work could be coupled to list fetches | count work only when requested |
| Backend startup | readiness did not force DB warm-up | Prisma connect and `SELECT 1` before ready log |
| Request observability | no per-request response timing header | `X-Response-Time` header and slow-request logging |

## Remaining Profiling Gaps
The following were not completed because the current repo does not yet contain the required scripts or instrumentation artifacts:

| Gap | Current state | Recommended next step |
|---|---|---|
| Lighthouse / Core Web Vitals | no Lighthouse script or saved report found | add a repeatable Lighthouse or Playwright trace script and record LCP/INP/CLS |
| Bundle attribution | Vite output sizes measured, no analyzer artifact | add bundle analyzer and save the generated report |
| Network waterfall artifact | browser request count verified, no HAR/JSON artifact saved except Playwright MCP page snapshot | add automated HAR/resource timing export |
| Prisma query plans | schema indexes exist, no `EXPLAIN ANALYZE` evidence | add query-plan script against representative Azure data |
| Concurrent load testing | no k6/autocannon script found | add a local API load probe for summary/list endpoints |
| Compression verification | asset transfer sizes observed, no gzip/brotli ratio report | verify `Content-Encoding` and compressed byte sizes for preview/API responses |
| Memory profiling | no heap snapshots or leak checks | add browser heap snapshot only if memory symptoms appear |

## Current Worktree Files
Application and docs files modified by the performance work:

```text
backend/src/index.ts
docs/analysis/TRACK_B_BACKEND_ANALYSIS.md
docs/analysis/backend_performance.md
docs/analysis/PERFORMANCE_PROFILING_REPORT_2026-05-22.md
src/components/dashboard/dashboard-page.tsx
src/components/dashboard/occupancy-chart.tsx
src/hooks/use-dashboard-data.ts
src/lib/query-keys.ts
src/lib/repositories/rest-repositories.ts
src/lib/repositories/types.ts
```

Untracked local tool artifacts observed:

```text
.omo/
.playwright-mcp/page-2026-05-22T05-47-19-963Z.yml
```

## Conclusion
The current webapp has now been profiled at the build, backend endpoint, production asset, and browser-network levels. The implemented optimization collapses dashboard runtime data loading into one summary endpoint, removes a chart-level waterfall query, makes expensive count work opt-in, and adds backend response timing observability. Remaining performance work should focus on repeatable Lighthouse/Core Web Vitals capture, bundle attribution, saved network waterfalls, and representative Prisma query-plan/load testing.
