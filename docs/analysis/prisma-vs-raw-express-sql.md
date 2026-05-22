# Prisma vs Raw Express SQL Implementation Comparison

> **Scope:** Track B backend data access strategy for Express API endpoints using Azure PostgreSQL as the source of truth.

---

## Executive Summary

The current Track B stack uses:

```text
React + TanStack Query
  -> frontend repository layer
  -> Express REST API
  -> Prisma Client
  -> Azure PostgreSQL
```

A proposed alternative is:

```text
React + TanStack Query
  -> frontend repository layer
  -> Express REST API
  -> raw SQL driver (`pg`, `postgres.js`, or similar)
  -> Azure PostgreSQL
```

The main question is whether replacing Prisma with direct SQL inside Express endpoints would improve Dashboard and Reservations performance.

**Recommendation:** Do not replace Prisma wholesale at this stage. Keep Prisma for schema, migrations, ordinary CRUD/read endpoints, and type-safe access. Use raw SQL selectively through `prisma.$queryRaw` or a typed SQL helper only for high-value aggregate endpoints such as dashboard summary queries.

The observed 5–10 second load time is more likely caused by Azure PostgreSQL cold connection latency, over-fetching, multiple parallel REST requests, missing dashboard aggregation, and lack of pagination than by Prisma itself.

---

## Option A: Keep Prisma As Primary Data Access

### Shape

```ts
const reservations = await prisma.reservations.findMany({
  where,
  select: {
    id: true,
    property_id: true,
    status: true,
    check_in_date: true,
    check_out_date: true,
    guest_name: true,
  },
});
```

### Pros

| Area | Benefit |
|---|---|
| Type safety | Prisma generates TypeScript types from `schema.prisma`. |
| Migration workflow | Existing Prisma migrations are already the canonical Azure-safe migration path. |
| Developer velocity | Common `findMany`, `count`, `groupBy`, and relation queries are fast to write and review. |
| Schema centralization | `backend/prisma/schema.prisma` remains the single canonical Track B schema source. |
| Safer parameterization | Prisma query builder avoids most SQL injection footguns by default. |
| Existing compatibility | Current backend routes and ingestion logic already depend on Prisma. |
| Maintainability | Easier for future agents/developers to understand than handwritten SQL everywhere. |

### Cons

| Area | Tradeoff |
|---|---|
| Cold startup | Prisma Client initialization and first DB connection can add latency, especially against remote Azure PostgreSQL. |
| Less SQL control | Complex dashboard aggregation may be harder to express cleanly with nested Prisma calls. |
| Query opacity | Generated SQL is not always obvious unless query logging is enabled. |
| Bundle/runtime size | Prisma Client is heavier than a raw SQL driver. |
| Connection behavior | Pool tuning is mostly handled through connection-string parameters rather than direct pool code. |

### Best Use Cases

- Standard collection endpoints: `/api/properties`, `/api/rooms`, `/api/reservations`
- Basic filtering and pagination
- CRUD-like operational endpoints
- Ingestion persistence
- Schema-driven development and migrations

---

## Option B: Replace Prisma With Raw SQL in Express Endpoints

### Shape

```ts
const result = await pool.query(
  `
    SELECT id, property_id, status, check_in_date, check_out_date, guest_name
    FROM reservations
    WHERE property_id = $1
    ORDER BY check_in_date ASC
    LIMIT $2
  `,
  [propertyId, limit]
);
```

### Pros

| Area | Benefit |
|---|---|
| Full SQL control | Exact joins, CTEs, window functions, indexes, and query plans are directly visible. |
| Potentially lower overhead | `pg` or `postgres.js` has less runtime overhead than Prisma Client. |
| Easier aggregate tuning | Dashboard summary queries can be written as optimized SQL with `COUNT`, `GROUP BY`, CTEs, and filtered aggregates. |
| Direct pool control | `pg.Pool` exposes `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`, and other pool settings directly. |
| PostgreSQL-native features | Easier to use materialized views, `EXPLAIN ANALYZE`, custom SQL functions, advisory locks, or advanced JSON aggregation. |
| Transparent performance | What runs in PostgreSQL is exactly what appears in the SQL string. |

### Cons

| Area | Tradeoff |
|---|---|
| Type safety loss | Query result rows must be manually typed and kept aligned with DB schema. |
| Migration replacement needed | Removing Prisma means choosing another migration tool such as `node-pg-migrate`, `dbmate`, or raw SQL migration scripts. |
| Higher SQL injection risk | Every dynamic query must use parameter placeholders correctly. |
| More boilerplate | Each endpoint needs SQL, parameter construction, result mapping, validation, and error handling. |
| Schema drift risk | TypeScript may compile while SQL silently drifts from the real database schema. |
| Harder agentic maintenance | Future edits are more error-prone because SQL strings lack Prisma's generated model guidance. |
| Refactor cost | Existing backend routes, ingestion services, Prisma schema, and migrations would need significant rework. |

### Best Use Cases

- Highly optimized aggregate endpoints
- Complex reporting queries
- Queries that need PostgreSQL-specific features
- Performance-critical hot paths proven slow by measurement
- Cases where Prisma cannot express the needed SQL cleanly

---

## Option C: Hybrid Strategy (Recommended)

### Shape

```text
Express API
  -> Prisma for normal typed CRUD/read endpoints
  -> Prisma migrations for schema history
  -> prisma.$queryRaw or typed SQL helper for high-value aggregates
```

Example:

```ts
const summary = await prisma.$queryRaw`
  SELECT property_id, COUNT(*)::int AS active_reservations
  FROM reservations
  WHERE status IN ('confirmed', 'checked_in')
  GROUP BY property_id
`;
```

### Why This Fits Track B

| Need | Hybrid Fit |
|---|---|
| Keep current Prisma migrations | Preserved. |
| Avoid large rewrite | Preserved. |
| Improve dashboard performance | Use targeted raw SQL/aggregation where needed. |
| Keep type discipline | Prisma remains the source for most generated types. |
| Reduce risk | Only optimize proven hot paths. |
| Support Azure PostgreSQL | Works with existing database and deployment model. |

### Recommended Hybrid Boundary

| Endpoint Type | Preferred Implementation |
|---|---|
| `/api/properties` | Prisma `findMany` |
| `/api/rooms` | Prisma `findMany` with select + pagination/filtering |
| `/api/reservations` | Prisma `findMany` with pagination, filters, select |
| `/api/maintenance` | Prisma `findMany` with filters/pagination |
| `/api/guest-requests` | Prisma `findMany` with filters/pagination |
| `/api/dashboard/summary` | Prisma `groupBy`/`count` first; use `$queryRaw` if aggregate shape becomes complex |
| Occupancy series | Prisma first; raw SQL if `EXPLAIN ANALYZE` shows a need |
| Ingestion writes | Prisma, unless bulk import performance becomes a proven bottleneck |

---

## Performance Tradeoff Analysis

### What Raw SQL Can Improve

Raw SQL can help when the bottleneck is:

- PostgreSQL query shape
- Inefficient aggregate computation
- Too many separate ORM-generated queries
- Need for CTEs or filtered aggregate functions
- Need for one backend query instead of many client-driven calls

### What Raw SQL Will Not Fix

Raw SQL will not solve these by itself:

- Remote Azure PostgreSQL network latency
- Cold TCP/TLS/auth connection startup
- Frontend fetching seven datasets on every page
- Missing pagination
- Large JSON payloads
- Route bundle size
- Vite dev proxy overhead

If the current delay is mostly cold connection + over-fetching, replacing Prisma everywhere is the wrong first move.

---

## Decision Matrix

| Criterion | Prisma | Raw SQL | Hybrid |
|---|---:|---:|---:|
| Initial implementation effort | Low | High | Medium-low |
| Migration risk | Low | High | Low |
| Runtime type safety | High | Low unless extra tooling added | Medium-high |
| SQL control | Medium | High | High where needed |
| Dashboard aggregate performance ceiling | Medium-high | High | High |
| Maintenance burden | Low-medium | High | Medium |
| Security footgun risk | Low | Medium-high | Medium |
| Fit for current Track B stage | High | Low-medium | **Highest** |

---

## Practical Recommendation

### Do First

1. Add backend timing middleware.
2. Add Prisma query timing/logging in development.
3. Add `prisma.$connect()` during backend startup.
4. Split page-specific data hooks so each page stops loading unrelated datasets.
5. Add `/api/dashboard/summary` to reduce dashboard chattiness.
6. Add pagination and DTO field selection to table endpoints.

### Use Raw SQL Only If

- A measured endpoint remains slow after pagination and aggregation.
- `EXPLAIN ANALYZE` shows the SQL shape needs manual tuning.
- Prisma `groupBy`/`count` becomes awkward or inefficient for dashboard summary.
- A reporting query needs PostgreSQL-specific CTE/window/filter behavior.

### Do Not Do Yet

- Do not replace all Prisma routes with raw SQL preemptively.
- Do not abandon Prisma migrations without selecting and validating a replacement migration tool.
- Do not move SQL into frontend code.
- Do not bypass the repository boundary in frontend panels.

---

## Suggested Implementation Path

### Phase 1: Preserve Prisma, Fix Known Bottlenecks

- Add `prisma.$connect()` at startup.
- Add request duration logging.
- Remove unused `count()` calls where pagination is not requested.
- Add pagination defaults to list endpoints.

### Phase 2: Add Dashboard Aggregation

- Create `/api/dashboard/summary?date=YYYY-MM-DD`.
- Start with Prisma `Promise.all`, `count`, `groupBy`, and narrow `findMany` selections.
- Include occupancy data or ensure occupancy does not create a serial waterfall.

### Phase 3: Measure Again

- Compare request count.
- Compare transferred bytes.
- Compare slowest backend endpoint duration.
- Compare cold load vs warm navigation.

### Phase 4: Add Targeted Raw SQL If Needed

- Use `prisma.$queryRaw` for only the slow aggregate query.
- Keep result DTO explicit.
- Keep SQL parameterized.
- Add comments in the plan/doc explaining why raw SQL is justified for that endpoint.

---

## Final Recommendation

For Track B, the best path is:

```text
Keep Prisma as the default.
Use raw SQL selectively for measured aggregate hot paths.
Do not replace Prisma wholesale unless profiling proves Prisma is the dominant bottleneck.
```

This gives the project most of the performance benefit with far less risk than rewriting the backend data layer.
