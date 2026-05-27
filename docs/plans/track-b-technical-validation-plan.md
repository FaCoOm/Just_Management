# Track B Technical Validation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate and harden Track B's frontend/backend contract before feature expansion or public deployment.

**Architecture:** Keep current macro-architecture: React 19 + Vite frontend using TanStack Router and TanStack Query, repository-layer data access, Express REST API, Prisma, and Azure PostgreSQL. Focus first on contract truth, DTO discipline, typed query parsing, date correctness, and deployment safety rather than major framework changes.

**Tech Stack:** React 19, TypeScript, Vite 7, TanStack Router, TanStack Query, Tailwind CSS v4, shadcn/ui, Express 4, Prisma 6, Azure PostgreSQL.

---

## Executive Summary

Current architecture is mostly sound. Biggest problem is not the stack; biggest problem is contract drift between docs, frontend repository contracts, REST client behavior, and backend routes.

Keep:

```text
React 19 + TanStack Query/Router
  -> frontend repository layer
  -> Express REST API
  -> Prisma
  -> Azure PostgreSQL
```

Do not add GraphQL, BFF, event bus, Supabase revival, or major framework shift until the existing seams are truthful and verified.

## Evidence-Based Findings

### Runtime Documentation Drift

`README.md` currently describes an older runtime shape:

- `src/App.tsx` is listed as an entry point, but the file is absent.
- Current shell is `src/main.tsx` plus `src/router.tsx`.
- README says `VITE_TRACK` switches Track A/Track B in `use-dashboard-data.ts`.
- Current `src/hooks/use-dashboard-data.ts` hardwires `createRestRepositories()`.

Planning implication:

- Decide if this worktree is Track B only or truly dual Track A/B.
- If Track B only, update docs and env guidance.
- If dual-track remains required, restore factory selection without pushing fetch logic into panels.

### Frontend Architecture Is Mostly Right

Good current structure:

- Dashboard panels are props-driven.
- Fetching and derivation are centralized in `src/hooks/use-dashboard-data.ts`.
- Repository boundary exists under `src/lib/repositories/`.
- Dashboard orchestration remains in `src/components/dashboard/dashboard-page.tsx`.

Risk:

- `src/lib/repositories/rest-repositories.ts` trusts backend JSON shape via generic `getJson<T>()`.
- Runtime field drift becomes UI bugs instead of compile-time failures.

Planning implication:

- Add DTO discipline before feature growth.
- Consider runtime response validation at repository boundary if API contract remains volatile.

### Repository Contract Exceeds Backend Implementation

`src/lib/repositories/types.ts` defines a generic `Repository<T>` with:

```ts
getAll(): Promise<T[]>;
getById(id: string): Promise<T | null>;
```

REST implementation calls by-id endpoints for properties, rooms, guest requests, maintenance, and reservations.

Backend currently implements collection endpoints and `/api/reservations/:id`, but does not implement most other by-id routes.

Planning implication:

- Build endpoint-method matrix.
- Either add missing by-id routes or shrink/remove unused by-id methods from concrete repositories.
- Prefer truthful smaller contracts over broad fake compatibility.

### `getByStatus` Semantics Are Underdefined

Frontend interface accepts `ReservationStatus[]`.

REST implementation sends only `statuses[0]`.

Backend accepts only single `status`.

Planning implication:

- Choose one of:
  1. Change interface to single `status`.
  2. Add backend support for repeated or comma-separated statuses.
- Since dashboard currently filters multi-status collections locally, single-status may be sufficient unless broader UI needs server-side multi-status filtering.

### Backend Is Serviceable Sprint 1 Scaffold But Too Centralized

`backend/src/index.ts` currently owns:

- app setup
- CORS
- validation helpers
- all route handlers
- Prisma queries
- stats logic
- server startup

Planning implication:

- Do not modularize first.
- First close contract drift.
- Then split route modules by domain.

### Backend Validation Is Uneven

Good:

- Reservation date and status filters have validation.

Risk:

- Multiple route handlers use `where: any` and loose request query values.

Planning implication:

- Add typed query parser helpers.
- Replace `where: any` with typed Prisma where builders.
- Validate IDs, status unions, date keys, and pagination consistently.

### Security Exposure Risk: Room Passcodes

`/api/rooms` selects `passcode`.

If values are real access codes, unauthenticated exposure is high-risk.

Planning implication:

- Before public deploy, remove passcode from default room DTO or protect it behind auth/RBAC.
- Prefer safe room summary DTO and privileged room-detail DTO.

### Auth/RBAC Is Deferred But Deployment-Sensitive

Auth is deferred by design, but ingest routes can mutate/import operational data and room passcodes may leak.

Planning implication:

- Backend must remain private/internal until auth/RBAC exists.
- If public deploy is required, auth middleware becomes a blocker.

### Date Semantics Need Explicit Validation

Reservations use `@db.Date` in Prisma. Backend converts date keys through UTC helpers. Frontend maps dates into compatibility timestamps.

Planning implication:

- Add targeted Vietnam business-date QA.
- Test check-in today, checkout today, active stay crossing today, cancelled/no-show, and multi-room reservation.

## Target Architecture

### Keep

- React 19 + Vite frontend.
- TanStack Router route shell.
- TanStack Query server state.
- Repository boundary for frontend data access.
- Express + Prisma backend.
- Azure PostgreSQL.
- `reservations` as booking source of truth.
- `guests` as compatibility model/view only.
- Provider identifiers isolated in provider edge tables.

### Tighten

1. Repository interface is source of truth for frontend data needs.
2. REST endpoints match repository methods exactly.
3. Backend DTOs match frontend types.
4. Prisma models remain internal.
5. Public DTOs exclude sensitive fields unless authorized.
6. Query parsing is typed and reusable.
7. Date behavior is tested against Vietnam operating day.

### Avoid For Now

- GraphQL.
- New backend framework.
- Service mesh or event-driven architecture.
- Premature domain abstractions.
- Generic repository rewrite.
- Frontend fetches inside panels.
- Supabase-first runtime revival unless explicitly chosen.

---

## Chunk 1: Truth Inventory And Contract Matrix

### Task 1: Build repository/API contract matrix

**Files:**

- Create: `plans/track-b-contract-matrix.md`
- Read: `src/lib/repositories/types.ts`
- Read: `src/lib/repositories/rest-repositories.ts`
- Read: `backend/src/index.ts`
- Read: `src/hooks/use-dashboard-data.ts`

- [ ] **Step 1: Inventory repository methods**

  Read `src/lib/repositories/types.ts` and list every method on each repository interface.

- [ ] **Step 2: Map REST client URLs**

  Read `src/lib/repositories/rest-repositories.ts` and map every method to the URL it calls.

- [ ] **Step 3: Map backend routes**

  Read `backend/src/index.ts` and map implemented backend route patterns.

- [ ] **Step 4: Map UI consumers**

  Read `src/hooks/use-dashboard-data.ts` and page-level consumers to identify which repository methods are actively used.

- [ ] **Step 5: Create matrix**

  Create `plans/track-b-contract-matrix.md` with this table shape:

  ```markdown
  | Domain | Repository method | REST URL | Backend route exists | DTO fields | UI consumers | Status | Notes |
  |---|---|---|---|---|---|---|---|
  ```

- [ ] **Step 6: Mark status**

  Use only these status values:

  - `implemented`
  - `missing-backend-route`
  - `unused-contract-method`
  - `semantics-mismatch`
  - `needs-security-review`

- [ ] **Step 7: Verify no guesses**

  Every row must cite exact file paths and line ranges.

### Task 2: Decide Track B-only vs dual-track runtime

**Files:**

- Read: `README.md`
- Read: `.env.example`
- Read: `src/hooks/use-dashboard-data.ts`
- Read: `src/lib/repositories/index.ts`

- [ ] **Step 1: Compare docs to runtime**

  Identify every README/env claim that conflicts with current code.

- [ ] **Step 2: Choose runtime story**

  Decide one of:

  - Track B only.
  - Dual Track A/B.

- [ ] **Step 3: Record decision**

  Add decision section to `plans/track-b-contract-matrix.md`:

  ```markdown
  ## Runtime Decision

  Decision: Track B only | Dual Track A/B

  Reason:
  - ...

  Consequences:
  - ...
  ```

- [ ] **Step 4: Do not implement yet**

  Stop after recording decision unless separately authorized to modify code/docs.

---

## Chunk 2: Contract Closure Implementation Plan

### Task 3: Close missing repository/backend route gaps

**Files:**

- Modify if implementing routes: `backend/src/index.ts`
- Modify if shrinking contract: `src/lib/repositories/types.ts`
- Modify if shrinking REST implementation: `src/lib/repositories/rest-repositories.ts`
- Verify: `plans/track-b-contract-matrix.md`

- [ ] **Step 1: Review matrix rows marked `missing-backend-route`**

  Determine if each method is actively used.

- [ ] **Step 2: For actively used methods, add backend route**

  Add only required by-id endpoints. Keep response DTO aligned with list endpoint unless a detail shape is needed.

- [ ] **Step 3: For unused broad methods, remove or defer**

  Prefer shrinking interface if method exists only because of generic `Repository<T>` and no UI needs it.

- [ ] **Step 4: Verify repository calls no missing routes**

  Run backend and smoke-test each repository URL manually with `curl`.

Expected output:

- No repository method calls route that returns 404 due to missing backend route.

### Task 4: Align reservation status filtering semantics

**Files:**

- Modify: `src/lib/repositories/types.ts`
- Modify: `src/lib/repositories/rest-repositories.ts`
- Modify if needed: `backend/src/index.ts`

- [ ] **Step 1: Choose semantics**

  Choose exactly one:

  - single-status server filter
  - multi-status server filter

- [ ] **Step 2A: If single-status**

  Change repository interface from `getByStatus(statuses: ReservationStatus[])` to `getByStatus(status: ReservationStatus)`.

- [ ] **Step 2B: If multi-status**

  Support repeated query params or comma-separated values in backend and REST implementation.

- [ ] **Step 3: Verify behavior**

  Use `curl` with valid and invalid statuses.

Expected output:

- Valid status returns reservations.
- Invalid status returns 400.
- Interface and backend semantics match.

---

## Chunk 3: Boundary Hardening Plan

### Task 5: Add typed backend query parsing helpers

**Files:**

- Create or modify: `backend/src/http/query.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create query helper module**

  Add helpers for:

  - date key parsing
  - pagination parsing
  - reservation status parsing
  - maintenance status parsing
  - optional string param parsing

- [ ] **Step 2: Replace duplicated parsing in reservations route**

  Keep behavior same. Do not change date semantics in same step.

- [ ] **Step 3: Replace loose parsing in rooms, maintenance, guest requests**

  Remove route-local coercion where practical.

- [ ] **Step 4: Run backend build**

  Command:

  ```bash
  cd backend
  npm run build
  ```

Expected: exit code 0.

### Task 6: Replace `where: any` with typed Prisma where builders

**Files:**

- Modify: `backend/src/index.ts`
- Modify if created: `backend/src/http/query.ts`

- [ ] **Step 1: Import Prisma types**

  Use Prisma-generated where input types for each route.

- [ ] **Step 2: Replace reservations `where: any`**

  Use typed `Prisma.reservationsWhereInput` or equivalent generated type.

- [ ] **Step 3: Replace rooms, maintenance, guest-requests where objects**

  Use correct generated where input types.

- [ ] **Step 4: Run backend build**

  Command:

  ```bash
  cd backend
  npm run build
  ```

Expected: exit code 0.

---

## Chunk 4: DTO Discipline Plan

### Task 7: Define public DTO field policy

**Files:**

- Create: `plans/track-b-api-dto-policy.md`
- Read: `src/types/database.ts`
- Read: `backend/src/index.ts`

- [ ] **Step 1: List current frontend types**

  Inventory `Property`, `Room`, `Reservation`, `GuestRequest`, `MaintenanceIssue`, and `OccupancySeriesPoint`.

- [ ] **Step 2: List backend selected fields**

  Inventory selected fields for each API endpoint.

- [ ] **Step 3: Identify sensitive fields**

  Mark `rooms.passcode` as `sensitive` unless product owner confirms otherwise.

- [ ] **Step 4: Write policy**

  Create `plans/track-b-api-dto-policy.md` with:

  ```markdown
  | DTO | Source endpoint | Fields | Sensitive fields excluded | Notes |
  |---|---|---|---|---|
  ```

### Task 8: Remove or protect room passcodes before public deployment

**Files:**

- Modify: `backend/src/index.ts`
- Modify if frontend depends on field: `src/types/database.ts`
- Modify if frontend renders field: relevant room/dashboard component

- [ ] **Step 1: Check frontend passcode usage**

  Search for `passcode` usage in `src/`.

- [ ] **Step 2: If unused, remove from public `/api/rooms` select**

  Remove `passcode` from collection endpoint DTO.

- [ ] **Step 3: If used, require auth/RBAC before exposing**

  Do not expose real passcodes publicly without protected route.

- [ ] **Step 4: Verify frontend still builds**

  Command:

  ```bash
  npm run typecheck
  npm run build
  ```

Expected: exit code 0.

---

## Chunk 5: Date And Dashboard Semantics Plan

### Task 9: Validate Vietnam business-date behavior

**Files:**

- Read: `backend/src/index.ts`
- Read: `src/hooks/use-dashboard-data.ts`
- Read: `src/hooks/use-vietnam-clock.ts`

- [ ] **Step 1: Identify current date helpers**

  Document backend and frontend date conversion points.

- [ ] **Step 2: Prepare test records**

  Use existing DB records or seed data covering:

  - check-in today
  - checkout today
  - active stay crossing today
  - cancelled reservation
  - no-show reservation
  - multi-room reservation

- [ ] **Step 3: Smoke-test API date filters**

  Commands:

  ```bash
  curl "http://localhost:3001/api/reservations?check_in_date=YYYY-MM-DD"
  curl "http://localhost:3001/api/reservations?check_out_date=YYYY-MM-DD"
  curl "http://localhost:3001/api/stats/occupancy?days=7&end_date=YYYY-MM-DD"
  ```

- [ ] **Step 4: Verify dashboard counts**

  Run frontend and confirm arrivals, departures, checkouts, and occupancy match expected business date.

Expected:

- Vietnam business-date counts match seeded scenarios.
- Cancelled/no-show do not inflate occupancy.

### Task 10: Preserve reservation source-of-truth semantics

**Files:**

- Read: `src/hooks/use-dashboard-data.ts`
- Read: `src/types/database.ts`
- Read: `backend/prisma/schema.prisma`

- [ ] **Step 1: Confirm dashboard derives guests from reservations**

  Verify `toDashboardGuest` remains compatibility mapping.

- [ ] **Step 2: Document legacy `guests` boundary**

  Ensure plan/docs state that `guests` is not booking authority.

- [ ] **Step 3: Verify no panel fetches legacy guests as booking truth**

  Search dashboard and guest pages.

Expected:

- Reservation remains source of truth.
- Legacy guest compatibility does not regain authority.

---

## Chunk 6: Backend Modularization Plan

### Task 11: Split backend only after contracts are stable

**Files:**

- Modify: `backend/src/index.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Create: `backend/src/prisma.ts`
- Create: `backend/src/routes/properties.ts`
- Create: `backend/src/routes/rooms.ts`
- Create: `backend/src/routes/reservations.ts`
- Create: `backend/src/routes/maintenance.ts`
- Create: `backend/src/routes/guest-requests.ts`
- Create: `backend/src/routes/stats.ts`

- [ ] **Step 1: Confirm prerequisite gates passed**

  Do not start until contract matrix has no unresolved missing routes or semantics mismatches.

- [ ] **Step 2: Extract app setup without changing behavior**

  Move Express app construction into `backend/src/app.ts`.

- [ ] **Step 3: Extract server startup**

  Move `app.listen` into `backend/src/server.ts`.

- [ ] **Step 4: Extract Prisma singleton**

  Move Prisma client construction into `backend/src/prisma.ts`.

- [ ] **Step 5: Extract one route domain at a time**

  Move routes incrementally and run build after each extraction.

- [ ] **Step 6: Run backend verification**

  Command:

  ```bash
  cd backend
  npm run build
  ```

Expected: exit code 0 and API smoke tests unchanged.

---

## Chunk 7: Operational Readiness Plan

### Task 12: Define pre-public-deploy checklist

**Files:**

- Create: `plans/track-b-deployment-readiness-checklist.md`
- Read: `README.md`
- Read: `backend/src/index.ts`
- Read: `backend/src/ingest/routes.ts`

- [ ] **Step 1: List public-risk endpoints**

  Include ingest routes, room routes, and any route returning operational data.

- [ ] **Step 2: Define auth/RBAC requirements**

  Minimum roles:

  - admin
  - operations manager
  - staff/read-only

- [ ] **Step 3: Define deployment constraints before auth exists**

  Backend must stay private/internal if auth is absent.

- [ ] **Step 4: Add verification checklist**

  Include CORS, env vars, room passcodes, ingest mutation protection, health/readiness, migration safety.

Expected output:

- Clear blocker list before public deployment.

---

## Verification Gates

### Static Type And Build Gate

Run:

```bash
npm run typecheck
npm run build
cd backend
npm run build
npm run db:generate
npm run db:validate
```

Expected:

- all exit code 0.

### API Smoke Gate

With backend running:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/properties
curl http://localhost:3001/api/rooms
curl http://localhost:3001/api/reservations
curl "http://localhost:3001/api/reservations?check_in_date=2026-05-20"
curl "http://localhost:3001/api/stats/occupancy?days=7&end_date=2026-05-20"
```

Check:

- status code
- JSON shape
- `X-Total-Count` where expected
- no sensitive passcodes on public-safe endpoints

### Dashboard Data Gate

Verify all seven dashboard queries in `src/hooks/use-dashboard-data.ts` resolve:

1. properties
2. rooms
3. reservations
4. guest requests
5. maintenance
6. arrivals by date
7. departures by date

Expected:

- dashboard loads
- no query errors
- loading state resolves
- KPI counts render
- desktop `BookingsPanel` behavior intact

### Date Correctness Gate

Seed or identify:

- check-in today
- checkout today
- active stay crossing today
- cancelled reservation
- no-show reservation
- multi-room reservation

Expected:

- arrivals correct
- departures correct
- occupancy correct
- cancelled/no-show excluded from occupancy
- Vietnam date boundary honored

### Migration Safety Gate

For schema work:

```bash
cd backend
npm run db:verify:migration
```

Also inspect generated migration:

- no accidental drops
- additive changes preferred
- `supabase/migrations` not used for Azure deployment

## Implementation Order

1. Complete Chunk 1.
2. Review matrix and runtime decision.
3. Complete Chunk 2.
4. Run static and API smoke gates.
5. Complete Chunk 3.
6. Run backend build and API smoke gates.
7. Complete Chunk 4.
8. Run security exposure review.
9. Complete Chunk 5.
10. Run dashboard and date correctness gates.
11. Complete Chunk 6 only if file size/maintenance burden still justifies split.
12. Complete Chunk 7 before any public deployment.

## Recommended First Execution Task

Start with Chunk 1 only:

```text
Create plans/track-b-contract-matrix.md by mapping repository methods to REST URLs, backend routes, DTO fields, UI consumers, and status.
```

Do not edit runtime code until the matrix exposes exact gaps and the Track B-only vs dual-track decision is made.
