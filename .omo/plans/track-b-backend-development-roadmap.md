# Track B Backend Development Roadmap

> **For Sisyphus execution:** Use this plan with `/start-work` or equivalent Sisyphus plan execution. Required execution style: small sequential chunks, verify after each chunk, no Redis/BullMQ until adoption triggers are met.

**Goal:** Evolve the Track B backend into a secure, observable, performant modular monolith before adding Redis/BullMQ or other distributed infrastructure.

**Architecture:** Keep Express + Prisma + Azure PostgreSQL. Split the current backend into app/server/infra/http/modules layers, harden API contracts and DTOs, then add observability, auth/RBAC, performance fixes, and only later Redis/BullMQ for proven queue/cache/rate-limit needs.

**Tech Stack:** Node.js, Express 4, TypeScript, Prisma 6, Azure PostgreSQL, optional later Redis, BullMQ, Zod/OpenAPI, Pino, OpenTelemetry.

---

## Execution Rules

- Do not add Redis first.
- Do not add BullMQ first.
- Do not refactor unrelated frontend code.
- Do not revive Supabase runtime.
- Do not expose room passcodes through public endpoints.
- Do not use `any` or type suppression.
- Preserve existing ingestion behavior unless a task explicitly changes it.
- Run verification commands after each implementation chunk.
- If implementation touches schema, inspect migration and run migration guard.

## Current Backend Diagnosis

### Known Strengths

- TypeScript strict mode is enabled in `backend/tsconfig.json`.
- Backend LSP diagnostics were clean during analysis.
- Prisma schema has coherent Track B model: `reservations` as source of truth, `guests` as compatibility model, provider edge tables isolated.
- Ingest subsystem is better separated than main API: `contracts.ts`, `normalizer.ts`, `parser.ts`, `routes.ts`, and services.
- `sync_runs` and `sync_dead_letters` provide a strong foundation for import observability.
- Migration guard exists in `backend/scripts/verify-azure-migration.mjs`.
- Ingestion verification harness exists in `backend/scripts/verify-ingestion.ts`.

### Known Risks

- Main API is centralized in `backend/src/index.ts`.
- No auth/RBAC protects data or ingest mutation routes.
- Frontend repository/backend route contract drift exists.
- `where: any` appears in backend route query construction.
- `/api/rooms` selects `passcode`.
- Occupancy endpoint calculates O(days × reservations) in Node.
- Ingest work runs synchronously inside HTTP request.
- No structured logging, request IDs, metrics, tracing, or DB readiness check.
- Prisma client lifecycle is not centralized across main API and ingest services.
- Redis/BullMQ absent; useful later, not first.

## Target Backend Shape

```text
backend/src/
  server.ts
  app.ts
  infra/
    prisma.ts
    logger.ts
  http/
    async-handler.ts
    errors.ts
    query.ts
    request-id.ts
  modules/
    properties/
      routes.ts
      controller.ts
      service.ts
      repository.ts
      dto.ts
    rooms/
      routes.ts
      controller.ts
      service.ts
      repository.ts
      dto.ts
    reservations/
      routes.ts
      controller.ts
      service.ts
      repository.ts
      dto.ts
    maintenance/
      routes.ts
      controller.ts
      service.ts
      repository.ts
      dto.ts
    guest-requests/
      routes.ts
      controller.ts
      service.ts
      repository.ts
      dto.ts
    stats/
      routes.ts
      controller.ts
      service.ts
      repository.ts
      dto.ts
    ingest/
      routes.ts
      controller.ts
      service.ts
      dto.ts
```

This target is a modular monolith. Do not introduce microservices.

---

## Chunk 1: Backend API Matrix And Security Inventory

**Purpose:** Establish truth before modifying runtime behavior.

**Files:**

- Read: `backend/src/index.ts`
- Read: `backend/src/ingest/routes.ts`
- Read: `src/lib/repositories/types.ts`
- Read: `src/lib/repositories/rest-repositories.ts`
- Read: `src/hooks/use-dashboard-data.ts`
- Create: `.sisyphus/plans/track-b-backend-api-matrix.md`

- [ ] Map every frontend repository method to REST URL.
- [ ] Map every backend route to method, path, query params, response shape, cache policy.
- [ ] Mark missing backend routes called by frontend repositories.
- [ ] Mark unused repository methods.
- [ ] Mark sensitive response fields, especially `rooms.passcode`, guest contact fields, provider raw payloads.
- [ ] Mark mutation routes, especially ingest endpoints.
- [ ] Write `.sisyphus/plans/track-b-backend-api-matrix.md` with:

```markdown
| Domain | Repository method | REST URL | Backend route | DTO fields | UI consumer | Status | Risk |
|---|---|---|---|---|---|---|---|
```

**Verification:**

```bash
cd backend
npm run build
```

Expected: exit code 0. No runtime code should be changed in this chunk.

---

## Chunk 2: Foundation Safety Fixes

**Purpose:** Remove contract/security hazards before architecture work.

**Files:**

- Modify: `backend/src/index.ts`
- Modify if needed: `src/lib/repositories/types.ts`
- Modify if needed: `src/lib/repositories/rest-repositories.ts`
- Modify if needed: `src/types/database.ts`

- [ ] Resolve missing route/frontend repository drift from matrix.
- [ ] Either add missing by-id endpoints or remove unused by-id methods from concrete contracts.
- [ ] Align `getByStatus` semantics: single status or real multi-status support.
- [ ] Normalize reservation date query semantics:
  - exact check-in: `check_in_date`
  - exact checkout: `check_out_date`
  - range/overlap: use explicitly named `from`/`to` or document current behavior.
- [ ] Remove `passcode` from general `/api/rooms` response unless a privileged auth-protected route exists.
- [ ] Add or split health endpoints:
  - `/health/live` for process liveness
  - `/health/ready` for DB readiness
- [ ] Add graceful shutdown handler for `SIGTERM`/`SIGINT`.
- [ ] Create shared Prisma client module if feasible in this chunk.

**Verification:**

```bash
cd backend
npm run build
npm run db:validate
```

Smoke commands:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready
curl http://localhost:3001/api/properties
curl http://localhost:3001/api/rooms
curl http://localhost:3001/api/reservations
curl "http://localhost:3001/api/stats/occupancy?days=7&end_date=2026-05-20"
```

Expected:

- build passes
- all called repository URLs route to implemented backend endpoints
- general room list does not expose passcode unless explicitly protected

---

## Chunk 3: Modular Monolith Split

**Purpose:** Make backend changes maintainable without changing behavior.

**Files:**

- Modify: `backend/src/index.ts`
- Create: `backend/src/server.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/infra/prisma.ts`
- Create: `backend/src/http/async-handler.ts`
- Create: `backend/src/http/errors.ts`
- Create domain modules under `backend/src/modules/`

- [ ] Extract Express app construction to `backend/src/app.ts`.
- [ ] Extract server startup to `backend/src/server.ts`.
- [ ] Extract Prisma client lifecycle to `backend/src/infra/prisma.ts`.
- [ ] Extract async handler to `backend/src/http/async-handler.ts`.
- [ ] Extract common cache/header helpers to HTTP utility module.
- [ ] Move one route domain at a time:
  - properties
  - rooms
  - reservations
  - stats
  - maintenance
  - channels/external accounts
  - guest requests
  - guests compatibility
  - ingest
- [ ] Run build after each domain move.

**Verification:**

```bash
cd backend
npm run build
npm run verify-ingestion
```

Expected:

- no route behavior changes except those already done in Chunk 2
- ingest verification still passes
- `index.ts` no longer owns all app concerns

---

## Chunk 4: Typed Validation And DTO Layer

**Purpose:** Make request parsing and response shapes explicit.

**Files:**

- Create: `backend/src/http/query.ts`
- Create: `backend/src/http/errors.ts` if not created
- Create or modify: `backend/src/modules/*/dto.ts`
- Modify: route/controller modules

- [ ] Add query parsers for:
  - date key
  - date range
  - pagination
  - UUID-like string
  - reservation status
  - maintenance status
  - optional string filters
- [ ] Replace all route/controller `where: any` with typed Prisma where input objects.
- [ ] Add DTO mappers for:
  - property
  - room summary
  - reservation
  - maintenance issue
  - guest request
  - occupancy point
- [ ] Standardize error shape:

```json
{ "error": { "code": "INVALID_QUERY", "message": "..." } }
```

- [ ] Keep internal Prisma model shape out of public API responses.
- [ ] Use Zod only if hand-written parsers become too broad or need OpenAPI generation soon.

**Verification:**

```bash
cd backend
npm run build
```

Manual invalid-query smoke:

```bash
curl "http://localhost:3001/api/reservations?status=bad-status"
curl "http://localhost:3001/api/reservations?check_in_date=bad-date"
curl "http://localhost:3001/api/stats/occupancy?days=999"
```

Expected:

- invalid filters return 400 with stable error shape
- no `where: any` remains in route/controller layer

---

## Chunk 5: Occupancy And Query Performance

**Purpose:** Fix true backend algorithmic bottlenecks before caching.

**Files:**

- Modify: `backend/src/modules/stats/service.ts`
- Modify: `backend/src/modules/stats/repository.ts`
- Possibly modify: `backend/prisma/schema.prisma`
- Possibly add migration under `backend/prisma/migrations/`

- [ ] Replace Node O(days × reservation_count) occupancy calculation with PostgreSQL aggregation.
- [ ] Use `generate_series` or equivalent SQL date series via typed `$queryRaw` if Prisma query builder cannot express it cleanly.
- [ ] Ensure cancelled/no-show reservations are excluded.
- [ ] Ensure multi-room allocations count distinct rooms.
- [ ] Ensure primary room fallback works.
- [ ] Replace JS room-count filtering with SQL aggregation.
- [ ] Review indexes used by reservations date overlap queries.
- [ ] Add indexes only if query plan proves need.

Example SQL shape to adapt safely:

```sql
WITH days AS (
  SELECT generate_series($1::date, $2::date, interval '1 day')::date AS day
),
active_reservations AS (
  SELECT
    d.day,
    COALESCE(rra.room_id, r.primary_room_id) AS room_id,
    r.id AS reservation_id
  FROM days d
  JOIN reservations r
    ON r.check_in_date <= d.day
   AND r.check_out_date > d.day
   AND r.status NOT IN ('cancelled', 'no_show')
  LEFT JOIN reservation_room_allocations rra
    ON rra.reservation_id = r.id
)
SELECT
  day,
  COUNT(DISTINCT COALESCE(room_id::text, 'reservation:' || reservation_id::text)) AS occupied
FROM active_reservations
GROUP BY day
ORDER BY day;
```

**Verification:**

```bash
cd backend
npm run build
npm run db:validate
```

If schema/migration changed:

```bash
cd backend
npm run db:verify:migration
```

Manual smoke:

```bash
curl "http://localhost:3001/api/stats/occupancy?days=7&end_date=2026-05-20"
curl "http://localhost:3001/api/stats/occupancy?days=60&end_date=2026-05-20"
```

Expected:

- output shape unchanged for frontend
- occupancy counts match known sample records
- no Redis cache needed unless query still exceeds target p95

---

## Chunk 6: Ingestion Hardening Before Queues

**Purpose:** Make sync/import reliable before BullMQ.

**Files:**

- Modify: `backend/src/ingest/services/listings.ts`
- Modify: `backend/src/ingest/services/reservations.ts`
- Modify: `backend/src/ingest/services/sheets.ts`
- Modify: `backend/src/ingest/routes.ts`
- Modify if needed: `backend/src/ingest/contracts.ts`

- [ ] Inject shared Prisma client into ingestion services.
- [ ] Move validation that can happen before transactions out of transaction scope.
- [ ] Batch lookup aliases/listings/accounts before per-row writes.
- [ ] Batch writes in chunks of 50-100 rows where safe.
- [ ] Make source accounts data-driven from `external_accounts` instead of hardcoded array where feasible.
- [ ] Remove hardcoded `airbnb` provider assumptions where feasible.
- [ ] Ensure sync run status transitions are reliable:
  - `started`
  - `completed`
  - `failed`
- [ ] Ensure `finished_at` written on success/failure.
- [ ] Ensure dead letters are written consistently.
- [ ] Add read endpoints if needed:
  - `GET /api/sync-runs/:id`
  - `GET /api/sync-runs/:id/dead-letters`

**Verification:**

```bash
cd backend
npm run build
npm run verify-ingestion
```

Expected:

- dry-run does not mutate business tables
- idempotency run does not create duplicates
- malformed rows become dead letters
- sync run status/counts accurate

---

## Chunk 7: Observability Baseline

**Purpose:** Make production behavior inspectable before Redis/workers.

**Files:**

- Modify: `backend/package.json`
- Create: `backend/src/infra/logger.ts`
- Create: `backend/src/http/request-id.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/http/errors.ts`

- [ ] Add Pino dependency.
- [ ] Add structured logger module.
- [ ] Add request ID middleware.
- [ ] Log method, path, status, duration, request ID.
- [ ] Log errors with stack server-side.
- [ ] Keep client error responses safe.
- [ ] Add optional Prisma warning/error logging.
- [ ] Add slow endpoint logging threshold.
- [ ] Consider OpenTelemetry after Pino/request IDs are stable.

**Verification:**

```bash
cd backend
npm run build
```

Manual smoke:

```bash
curl http://localhost:3001/health/live
curl http://localhost:3001/api/properties
```

Expected:

- structured JSON logs include request ID and latency
- 500 logs include useful server-side stack

---

## Chunk 8: Auth/RBAC Design And Implementation

**Purpose:** Make backend safe for real users and public deployment.

**Files:**

- Create: `backend/src/auth/` modules
- Modify: `backend/src/app.ts`
- Modify: route modules requiring protection
- Modify: DTO field policy for sensitive fields

- [ ] Choose auth provider:
  - Clerk/Auth0 for hosted identity
  - Azure AD if Microsoft tenant integration is required
  - API key only for internal automation, not user app auth
- [ ] Add authentication middleware.
- [ ] Add user context type.
- [ ] Add roles:
  - admin
  - operations manager
  - staff
  - read-only
- [ ] Add property-level permission check plan.
- [ ] Protect ingest endpoints.
- [ ] Protect any room passcode endpoint if one exists.
- [ ] Add audit logging for mutations and sync triggers.

**Decision gate before implementation:**

- [ ] Pick one auth provider before writing auth code.
- [ ] Record provider decision in `.sisyphus/plans/track-b-auth-rbac-decision.md`.
- [ ] If no provider can be chosen, stop and ask user; do not implement placeholder auth.

Decision record format:

```markdown
# Track B Auth/RBAC Decision

Provider: Clerk | Auth0 | Azure AD | Internal API key only

Reason:
- ...

Token verification approach:
- ...

Roles:
- admin
- operations manager
- staff
- read-only

Protected endpoints:
- ...

Sensitive fields:
- ...
```

**Verification:**

Manual smoke:

```bash
curl http://localhost:3001/api/rooms
curl -H "Authorization: Bearer INVALID" http://localhost:3001/api/rooms
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3001/api/rooms
curl -H "Authorization: Bearer $STAFF_TOKEN" http://localhost:3001/api/rooms
curl -H "Authorization: Bearer $READONLY_TOKEN" http://localhost:3001/api/rooms
curl -X POST http://localhost:3001/api/ingest/listings
curl -X POST -H "Authorization: Bearer $STAFF_TOKEN" http://localhost:3001/api/ingest/listings
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3001/api/ingest/listings
```

Expected:

- anonymous protected reads return 401
- invalid token returns 401
- valid admin token can access admin-protected endpoints
- valid staff token can access staff-allowed read/update endpoints
- read-only token can access read endpoints but cannot trigger ingest/mutations
- staff token cannot trigger ingest unless explicitly allowed by decision record
- admin token can trigger ingest only after body validation passes
- public room list never returns `passcode`
- any privileged passcode endpoint returns 403 for read-only/staff unless explicitly allowed
- all denied requests include stable error body and request ID

---

## Chunk 9: Redis/BullMQ Queue Adoption

**Purpose:** Add async workers only after baseline backend is safe and observable.

**Do not start unless at least one trigger is true:**

- sync upload exceeds request timeout
- provider sync must run on schedule
- retries/backoff required
- progress UI required
- multi-instance worker scaling required

**Files:**

- Modify: `backend/package.json`
- Create: `backend/src/infra/redis.ts`
- Create: `backend/src/infra/queue.ts`
- Create: `backend/src/workers/ingest-worker.ts`
- Modify: ingest route/controller/service modules

- [ ] Add Redis client dependency.
- [ ] Add BullMQ dependency.
- [ ] Add queue config with env validation.
- [ ] Add ingest job enqueue endpoint.
- [ ] Return `syncRunId` and `jobId` immediately.
- [ ] Add worker process for listings/reservations/sheets sync.
- [ ] Add retry/backoff policy.
- [ ] Add idempotency key strategy.
- [ ] Update `sync_runs` progress from worker.
- [ ] Add queue health/readiness checks.
- [ ] Add queue metrics/logging.

**Verification:**

```bash
cd backend
npm run build
npm run verify-ingestion
```

Expected:

- HTTP ingest returns quickly with job ID
- worker processes job
- sync run progresses to completed/failed
- dead letters still written
- Redis-down behavior documented and safe

---

## Chunk 10: Redis Read Cache Adoption

**Purpose:** Reduce DB pressure only for proven hot reads.

**Do not start unless performance evidence exists after SQL/index fixes.**

Cache candidates:

- properties
- channels
- external accounts
- occupancy aggregate if still slow
- dashboard summary endpoint if created

Never cache:

- room passcodes
- secret-bearing payloads
- mutable operational records without invalidation policy

- [ ] Capture p50/p95 before cache.
- [ ] Add cache-aside helper.
- [ ] Add endpoint-specific TTL.
- [ ] Add cache key naming convention.
- [ ] Add stampede protection if needed.
- [ ] Add metrics for hit/miss/error.
- [ ] Capture p50/p95 after cache.

**Verification:**

Install/use a local benchmark tool approved by project maintainers. Preferred command if dependency is available:

```bash
cd backend
npm run build
npx autocannon -d 30 -c 20 http://localhost:3001/api/properties
npx autocannon -d 30 -c 20 "http://localhost:3001/api/stats/occupancy?days=30&end_date=2026-05-20"
```

If `autocannon` is not available, use repeated curl timing as fallback:

```bash
for i in 1 2 3 4 5; do curl -s -o NUL -w "%{http_code} %{time_total}\n" http://localhost:3001/api/properties; done
for i in 1 2 3 4 5; do curl -s -o NUL -w "%{http_code} %{time_total}\n" "http://localhost:3001/api/stats/occupancy?days=30&end_date=2026-05-20"; done
```

Redis verification when cache is added:

```bash
redis-cli PING
redis-cli --scan --pattern "track-b:*"
curl http://localhost:3001/api/properties
redis-cli --scan --pattern "track-b:*"
curl http://localhost:3001/api/properties
```

Redis-down fallback check:

```bash
# Stop local Redis or point REDIS_URL at an unavailable local port in a controlled dev environment.
curl http://localhost:3001/api/properties
curl "http://localhost:3001/api/stats/occupancy?days=30&end_date=2026-05-20"
```

Expected:

- measured latency or DB-load improvement
- stale data risk documented and acceptable
- cache failure falls back safely to DB where appropriate
- first request logs `cache=miss`, second request logs `cache=hit` for cache-enabled endpoints
- Redis-down path returns correct HTTP 200 for non-secret read endpoints or documented 503 if fallback intentionally disabled
- cache keys use documented `track-b:<domain>:<version>:<params>` naming
- no Redis key contains `passcode`, guest phone/email, raw payload, or token material

---

## Chunk 11: OpenAPI And Contract Automation

**Purpose:** Prevent future API drift.

**Do after route/DTO shapes stabilize.**

**Files:**

- Modify: `backend/package.json`
- Create: `backend/src/openapi/`
- Modify: validation/DTO modules

- [ ] Add Zod schemas for request queries/bodies.
- [ ] Add Zod schemas for response DTOs.
- [ ] Add zod-to-openapi or equivalent.
- [ ] Generate OpenAPI spec.
- [ ] Add `/api/docs` or static spec export if appropriate.
- [ ] Add contract test checking frontend repository URLs exist in backend route map.

**Verification:**

```bash
cd backend
npm run build
npm run openapi:generate
npm run contract:routes
```

If scripts do not exist yet, this chunk must add them to `backend/package.json` before marking complete:

```json
{
  "scripts": {
    "openapi:generate": "tsx scripts/generate-openapi.ts",
    "contract:routes": "tsx scripts/verify-route-contract.ts"
  }
}
```

Contract test behavior:

- [ ] test reads frontend REST repository route list or a maintained route manifest
- [ ] test reads backend route manifest/OpenAPI paths
- [ ] test fails when a repository URL has no matching backend route
- [ ] test fails when OpenAPI response schema omits fields required by frontend DTO
- [ ] test passes when repository/backend route and DTO contracts match

Negative control:

```bash
# Temporarily point one route in the contract fixture to /api/__missing_contract_test__.
npm run contract:routes
# Expected: non-zero exit and message naming missing route.
# Revert fixture change immediately after proving failure mode.
```

Expected:

- OpenAPI generation succeeds
- contract drift test fails if backend route missing
- generated spec is written to `backend/openapi.json` or documented equivalent
- contract test has proven fail/pass behavior

---

## Global Verification Gates

### Backend Build Gate

```bash
cd backend
npm run build
```

### Prisma Gate

```bash
cd backend
npm run db:generate
npm run db:validate
```

### Migration Gate

Run when schema/migrations change:

```bash
cd backend
npm run db:verify:migration
```

### Ingestion Gate

Run when ingest changes:

```bash
cd backend
npm run verify-ingestion
```

### Full Backend Gate

```bash
cd backend
npm run verify:all
```

### API Smoke Gate

With backend running:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready
curl http://localhost:3001/api/properties
curl http://localhost:3001/api/rooms
curl http://localhost:3001/api/reservations
curl "http://localhost:3001/api/reservations?check_in_date=2026-05-20"
curl "http://localhost:3001/api/stats/occupancy?days=7&end_date=2026-05-20"
```

## Technology Adoption Rubric

Before adding any backend technology, answer yes to all:

| Question | Add if yes | Defer if no |
|---|---|---|
| Pain proven? | measured latency, timeout, blocked UX, security gap | future concern only |
| Simpler fix tried? | SQL/index/service split insufficient | current stack can solve |
| Owner clear? | one module owns config/runtime | cross-cutting mystery |
| Failure safe? | outage/retry path known | new outage class breaks app |
| Verification exists? | benchmark/health/log/rollback | no success gate |

## Redis Decision

Redis is approved only for:

1. shared rate limiting
2. BullMQ queues
3. hot-read cache with measured need
4. session store only if server-side sessions are chosen

Redis is not approved for:

- hiding bad SQL
- solving contract drift
- caching secrets
- bypassing auth/RBAC
- premature scale story

## Recommended First Work Item

Start with Chunk 1:

```text
Build .sisyphus/plans/track-b-backend-api-matrix.md by mapping repository methods, REST URLs, backend routes, DTO fields, UI consumers, security exposure, and risk status.
```

Only after matrix is complete should runtime code changes begin.
