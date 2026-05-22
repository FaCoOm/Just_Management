# Supabase vs Azure PostgreSQL + Prisma Implementation Comparison

> **Scope:** Compare a Supabase-first implementation against the current Track B implementation: Express REST API + Prisma + Azure PostgreSQL.

---

## Executive Summary

The project currently follows Track B:

```text
React + TanStack Query
  -> frontend repository layer
  -> Express REST API
  -> Prisma Client
  -> Azure PostgreSQL
```

A Supabase-first implementation would look like either:

```text
React + TanStack Query
  -> Supabase JS client
  -> Supabase Postgres + Auth + RLS + Storage + Edge Functions
```

or a hybrid shape:

```text
React + TanStack Query
  -> Express API for privileged operations
  -> Supabase Postgres/Auth/RLS for selected data access
```

**Recommendation for this worktree:** Stay with **Azure PostgreSQL + Express + Prisma** as the Track B runtime. Supabase remains useful as schema-intent/reference history, but reviving Supabase as the runtime would increase contract drift and require a security/modeling reset.

The current performance issue is not primarily caused by Azure PostgreSQL or Prisma as a stack choice. It is caused by cold remote DB connections, dashboard over-fetching, too many API round trips, missing dashboard aggregation, unpaginated `getAll()` usage, and some client-side computation.

---

## Current Track B Implementation

### Runtime Shape

```text
Frontend
  React 19 + Vite + TanStack Query/Router
  Repository layer under src/lib/repositories/

Backend
  Express REST API
  Prisma Client
  Azure PostgreSQL

Schema source
  backend/prisma/schema.prisma
  backend/prisma/migrations/
```

### Strengths

| Area | Benefit |
|---|---|
| Explicit backend boundary | Frontend cannot directly mutate database tables; Express controls API shape. |
| Prisma schema authority | `backend/prisma/schema.prisma` is the canonical Track B schema. |
| Deployment alignment | Azure PostgreSQL is already the intended Track B source of truth. |
| Service-side DTO control | Backend can exclude sensitive fields, shape dashboard DTOs, and validate queries. |
| Operational flexibility | Express can implement ingestion routes, provider sync, reconciliation, logging, and custom authorization. |
| Easier backend observability | Request timing, Prisma query logging, route-level metrics, and API smoke tests are straightforward. |
| Avoids frontend DB coupling | React panels consume repository contracts, not database tables or Supabase table names. |

### Weaknesses

| Area | Tradeoff |
|---|---|
| More infrastructure | Must run and deploy both frontend and backend. |
| Cold DB connection latency | Remote Azure PostgreSQL can be slow on first request without connection warm-up. |
| Manual auth/RBAC required | Unlike Supabase, auth and row-level policies are not built in by default. |
| More API code | Express routes, query parsing, DTOs, and validation must be maintained. |
| Backend bottleneck risk | Poorly designed routes can over-fetch or fan out to many DB queries. |

### Best Fit

Track B is best when the app needs:

- Strong control over operational workflows
- Provider ingestion and reconciliation logic
- Backend-owned data normalization
- Custom dashboard aggregation
- A stable REST contract independent of database table layout
- Future enterprise/internal deployment controls

---

## Supabase-First Implementation

### Runtime Shape

```text
React frontend
  -> Supabase JS client
  -> Supabase Auth
  -> Supabase Postgres
  -> Row Level Security policies
  -> Supabase Edge Functions for privileged/server workflows
```

### Strengths

| Area | Benefit |
|---|---|
| Fast app scaffolding | Auth, database client, storage, realtime, and admin tooling are available quickly. |
| Built-in auth | Supabase Auth provides user/session handling without building custom auth from scratch. |
| Row Level Security | RLS can enforce data access at the database layer. |
| Realtime features | Useful if operational dashboards need live updates. |
| Less custom backend code | Simple CRUD screens can query Supabase directly. |
| Developer convenience | Supabase dashboard, SQL editor, table editor, logs, and auth UI accelerate iteration. |
| Postgres compatibility | Supabase is still PostgreSQL underneath. |

### Weaknesses

| Area | Tradeoff |
|---|---|
| Frontend-table coupling | Direct Supabase calls can couple UI to database table names and row shapes. |
| RLS complexity | Correct multi-property/hospitality access control must be encoded carefully in SQL policies. |
| Privileged workflow complexity | Ingestion, provider sync, reconciliation, and admin operations still need server-side functions. |
| Contract drift risk | Frontend types, RLS policies, SQL migrations, and docs can diverge if not strictly managed. |
| Runtime shift cost | Current Track B code already uses Express + Prisma; reverting to Supabase would require significant refactor. |
| Secret handling risk | Service-role keys must never reach frontend; privileged tasks require secure server context. |
| Vendor/platform coupling | More application behavior depends on Supabase-specific services beyond plain PostgreSQL. |

### Best Fit

Supabase-first is best when the app needs:

- Rapid MVP development
- Built-in Auth + RLS as the main security model
- Direct CRUD-heavy screens
- Realtime subscriptions
- Minimal custom backend logic
- Small team velocity over custom backend control

---

## Key Architectural Difference

### Current Track B

```text
UI asks the API for application concepts.
API decides how to query and shape database data.
```

Example:

```text
GET /api/dashboard/summary?date=YYYY-MM-DD
```

The frontend receives dashboard-ready DTOs.

### Supabase-First

```text
UI often queries database-shaped resources directly.
Database RLS decides row access.
```

Example:

```ts
supabase
  .from("reservations")
  .select("id, property_id, status, check_in_date, guest_name")
```

The frontend has more knowledge of table structure.

---

## Performance Comparison

| Performance Concern | Azure PG + Express + Prisma | Supabase-first |
|---|---|---|
| Cold connection | Backend must warm Prisma/Azure connection. | Supabase client talks to Supabase APIs; connection pooling is platform-managed. |
| Dashboard over-fetching | Fix with `/api/dashboard/summary`. | Direct frontend queries may still over-fetch unless RPC/views are used. |
| Multiple round trips | Fix with backend aggregation endpoint. | Could use Postgres functions/RPC, views, or Edge Functions. |
| Pagination | Must be implemented in Express/repositories. | Supabase supports range/limit, but frontend must use it consistently. |
| Client-side compute | Move to Express/Prisma aggregation. | Move to SQL views/RPC/functions. |
| Query tuning | Use Prisma logging + Azure Query Store + `EXPLAIN ANALYZE`. | Use Supabase SQL tools + `EXPLAIN ANALYZE`. |
| Realtime | Must add custom WebSocket/SSE/polling. | Built in through Supabase Realtime. |

**Important:** Supabase would not automatically fix the current dashboard problem. If the frontend still requests too many datasets and computes everything client-side, it can still be slow. The architectural fix is aggregation and pagination, regardless of provider.

---

## Security Comparison

| Security Area | Azure PG + Express + Prisma | Supabase-first |
|---|---|---|
| Auth | Must be added separately. | Built in through Supabase Auth. |
| Authorization | Express middleware / RBAC / route guards. | RLS policies in PostgreSQL. |
| Sensitive fields | API DTOs can exclude fields such as room passcodes. | RLS/policies/views must prevent exposure. |
| Privileged operations | Backend can use private credentials safely. | Must use Edge Functions/server-side service role, never frontend. |
| Public deploy readiness | Backend must remain private/internal until auth exists. | Safer public path if RLS is complete and tested. |
| Policy testing | App-level integration tests needed. | RLS-specific tests needed; policy bugs can leak data. |

For this hospitality dashboard, the highest-risk sensitive field is room access data such as `rooms.passcode`. In Track B, the safer default is to remove it from public room DTOs unless a protected route and role model exists.

---

## Data Modeling And Migration Comparison

| Area | Azure PG + Prisma | Supabase-first |
|---|---|---|
| Canonical schema | `backend/prisma/schema.prisma` | Supabase SQL migrations/schema |
| Migration runner | Prisma Migrate | Supabase CLI / raw SQL migrations |
| Type generation | Prisma Client types | Supabase generated DB types, if configured |
| Multi-schema support | Possible but must be configured in Prisma. | Native PostgreSQL schemas available. |
| Schema drift detection | `db:generate`, `db:validate`, migration checks. | Supabase migration diff/check workflow required. |
| Current repo alignment | Strong: Track B is already Prisma/Azure. | Weak: Supabase migrations are reference-only in this worktree. |

The repo currently states that `supabase/migrations/` is **reference-only schema intent** and Azure deployment uses `backend/prisma/schema.prisma` plus generated Prisma migrations. Moving back to Supabase would require an explicit architecture decision and migration plan, not a small performance optimization.

---

## Operational Workflow Comparison

| Workflow | Azure PG + Express + Prisma | Supabase-first |
|---|---|---|
| Provider ingestion | Natural fit in Express backend services. | Requires Edge Functions, external worker, or backend anyway. |
| File import/reconciliation | Backend can validate, normalize, write, and log. | Possible, but privileged logic still needs secure server context. |
| API observability | Express middleware can log per-route timings. | Supabase logs plus custom instrumentation in functions/client. |
| Background jobs | Add worker/cron in backend/Azure. | Supabase scheduled functions or external worker. |
| Custom business rules | Centralized in backend services. | Split between frontend, RLS, SQL functions, and Edge Functions unless disciplined. |

Track B's ingestion/provider-sync domain benefits from a backend service layer. Supabase can support it, but it does not remove the need for backend-like privileged code.

---

## Development Experience Comparison

| Developer Need | Azure PG + Express + Prisma | Supabase-first |
|---|---|---|
| Simple CRUD iteration | Medium speed | Very fast |
| Complex business workflows | Strong | Medium; often needs Edge Functions or backend |
| Type-safe queries | Strong through Prisma | Good if DB types are generated and maintained |
| Local development | Requires backend + DB/env setup | Supabase local stack or hosted project |
| Debugging API behavior | Clear route-level control | Split between frontend calls, RLS, functions, and Supabase logs |
| Agentic code changes | Easier to localize in backend routes/repositories | Requires careful RLS/policy/schema awareness |

---

## Decision Matrix

| Criterion | Supabase-first | Azure PG + Express + Prisma |
|---|---:|---:|
| Current repo alignment | Low | **High** |
| Built-in auth | **High** | Low until implemented |
| Custom backend workflow support | Medium | **High** |
| Dashboard aggregation control | Medium-high via SQL/RPC/functions | **High** via Express endpoint |
| Migration continuity | Low-medium | **High** |
| Performance ceiling | High | High |
| Short-term implementation risk | High | **Low-medium** |
| Long-term operational control | Medium | **High** |
| Realtime support | **High** | Medium-low unless added |
| Best fit for Track B now | Medium | **High** |

---

## When Supabase Would Be Worth Reconsidering

Supabase becomes more attractive if the product priorities shift toward:

- Built-in multi-user auth immediately
- Row-level tenant/property security at the database layer
- Realtime operations board updates
- Small-team rapid CRUD development over custom backend control
- Less Azure-specific infrastructure management

If this happens, the project should not partially revive Supabase ad hoc. It should create a formal migration plan covering:

1. Canonical schema source
2. Migration ownership
3. Auth/RLS policy model
4. Provider ingestion architecture
5. Frontend repository strategy
6. DTO/security boundary
7. Deployment topology
8. Data migration and rollback plan

---

## Recommended Track B Path

Stay with:

```text
React
  -> repository layer
  -> Express REST API
  -> Prisma
  -> Azure PostgreSQL
```

Then fix the actual performance bottlenecks:

1. Add `prisma.$connect()` at backend startup.
2. Add request timing and Prisma query timing.
3. Add `/api/dashboard/summary?date=YYYY-MM-DD&property_id=`.
4. Move occupancy data into the dashboard summary or prefetch it in the same hook.
5. Make pagination explicit in frontend repository contracts.
6. Make row counts opt-in instead of default for unpaginated `getAll()` calls.
7. Verify indexes with Azure Query Store or `EXPLAIN ANALYZE` before adding more.
8. Add auth/RBAC before public deployment.

---

## Final Recommendation

For this worktree, **Azure PostgreSQL + Express + Prisma remains the correct runtime choice**.

Supabase is still valuable as a reference point and possible future platform option, but switching back to Supabase would not directly solve the current dashboard latency issue. The fastest, lowest-risk path is to harden Track B: warm the Prisma connection, aggregate dashboard data server-side, paginate large list endpoints, and preserve the frontend repository boundary.
