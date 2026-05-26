# Task 0 Gap Audit — Sprint 1 Foundation vs Current Repo

## 1. Scope

This audit compares the **current implemented repository** against the Sprint 1 backlog and the dual-architecture PRD. It is intentionally limited to current repo reality and does **not** speculate about future migrations or backend code that does not exist yet.

This audit covers:
- Sprint 1 Story-01 through Story-05 from `plans/Scrum Backlog & Sprints.md:5-11`
- PRD Track A / Track B architecture expectations from `plans/Dual-Architecture PRD.md:15-41`
- PRD ingestion/idempotency requirements from `plans/Dual-Architecture PRD.md:51-56`
- PRD guest-history expectations from `plans/Dual-Architecture PRD.md:63-67`
- Current schema/runtime contract from:
  - `supabase/migrations/20260409044835_create_portfolio_schema.sql:62-152`
  - `src/types/database.ts:1-84`
  - `src/hooks/use-dashboard-data.ts:1-104`
  - `src/components/dashboard/dashboard-page.tsx:32-103`
  - `src/components/dashboard/arrivals-detail.tsx:17-93`
  - `src/components/dashboard/departures-detail.tsx:17-90`
  - `src/lib/supabase.ts:1-6`
  - `package.json:6-45`

Excluded on purpose:
- Sprint 2+ implementation work
- Proposed schema design beyond identifying concrete gaps
- Any file modifications outside Task 0 evidence/notepad artifacts

## 2. Source Files Reviewed

| File | Why it matters |
|---|---|
| `plans/Dual-Architecture PRD.md:15-41` | Defines Track A and Track B expectations, including TanStack Query, Supabase Auth, Node/Prisma, and Clerk/Auth0. |
| `plans/Dual-Architecture PRD.md:51-67` | Defines ingestion, idempotency, and guest-history expectations. |
| `plans/Scrum Backlog & Sprints.md:5-11` | Defines Story-01 through Story-05. |
| `plans/Scrum Backlog & Sprints.md:26-33` | Defines Sprint 1 tasks for TanStack Query/api folder, Supabase schema, Track B Node/Prisma, and auth UI. |
| `supabase/migrations/20260409044835_create_portfolio_schema.sql:62-152` | Shows the actual live table inventory: `properties`, `rooms`, `guests`, `guest_requests`, `maintenance_issues`. |
| `src/types/database.ts:1-84` | Shows the frontend contract mirrors only those five entities. |
| `src/hooks/use-dashboard-data.ts:38-50` | Shows direct `supabase.from(...)` reads against those same five tables. |
| `src/hooks/use-dashboard-data.ts:57-92` | Shows dashboard metrics are derived from `rooms`, `guests`, and `maintenance_issues`. |
| `src/components/dashboard/dashboard-page.tsx:71-80` | Confirms arrivals/departures UI is mounted on the current dashboard. |
| `src/components/dashboard/arrivals-detail.tsx:18-27` | Shows arrivals are derived from guest status only, not a reservation/date query. |
| `src/components/dashboard/departures-detail.tsx:18-27` | Shows departures are derived from guest status only, not a reservation/date query. |
| `src/lib/supabase.ts:1-6` | Shows the runtime data source is a direct Supabase client. |
| `package.json:12-45` | Shows the dependency set lacks TanStack Query, Axios, Express/Nest, Prisma, Clerk/Auth0. |

Additional repo verification:
- `glob("src/api/**")` returned **no files**, so Sprint 1's planned `api/` layer is not present.
- `glob("prisma/**")` returned **no files**, so Track B's Prisma mirror is not present.
- Repo search for `@tanstack/react-query|QueryClient|useQuery|useMutation` returned **no matches** in source files.
- Repo search for app auth implementation terms returned matches only in planning docs, not in runtime source files.

## 3. Sprint 1 Story-by-Story Matrix

| Sprint 1 story / PRD requirement | Current support status | Existing file(s) | Gap / implication | Required remediation task(s) |
|---|---|---|---|---|
| **STORY-01:** frontend abstraction layer / Repository Pattern so UI can swap between Supabase and Node (`plans/Scrum Backlog & Sprints.md:7`; `plans/Dual-Architecture PRD.md:28-30`) | **missing** | `src/hooks/use-dashboard-data.ts:38-50`, `src/lib/supabase.ts:1-6`, `package.json:12-45`, `glob("src/api/**") => no files` | The UI is directly coupled to `supabase.from(...)` inside a feature hook. There is no `api/` folder, no repository interface, no TanStack Query, and no Axios/Fetch adapter boundary for Track B. | **Task 9** (shared data-access foundation), informed by **Task 1** (canonical contract). |
| **STORY-02:** secure dashboard authentication (`plans/Scrum Backlog & Sprints.md:8`; `plans/Dual-Architecture PRD.md:20-21`, `:36-38`) | **missing** | `supabase/migrations/20260409044835_create_portfolio_schema.sql:72-77`, `:91-96`, `:112-117`, `:129-134`, `:147-152`; `package.json:12-45` | The schema enables demo-style public read policies for all current tables, and the repo contains no app auth dependency or provider wiring. The current runtime is dashboard-open, not Sprint 1 auth-ready. | **Task 11** (branch-aware auth UI and adapters). |
| **STORY-03:** schema supports Properties, Rooms, Guests, and Reservations with strict foreign keys (`plans/Scrum Backlog & Sprints.md:9`) | **partial** | `supabase/migrations/20260409044835_create_portfolio_schema.sql:62-152`; `src/types/database.ts:1-84` | `properties` and `rooms` exist with foreign keys; `guests` exists but is currently acting as the booking record. There is **no `reservations` table**, no reservation external identity, no reservation allocations, and no ingestion-safe reservation core. Current schema is enough for a dashboard demo, not for a reservation-centric PMS flow. | **Task 1** (canonical schema contract), **Task 4** (reservation core), **Task 5** (operational child linkage), **Task 6** (backfill/import path). |
| **STORY-04:** webhook endpoint for parsed booking JSON (`plans/Scrum Backlog & Sprints.md:10`; `plans/Dual-Architecture PRD.md:54-56`) | **missing** | `package.json:12-45`; `glob("prisma/**") => no files`; repo search found no Express/Nest/Prisma/backend implementation | There is no backend/API server in the repo, no webhook route, and no persistence model for reservation-id upsert semantics. Current Track A runtime is frontend + Supabase schema only. | **Task 6** (import/idempotency path) and **Task 10** (Track B scaffold); Track A endpoint strategy also depends on **Task 1/4**. |
| **STORY-05:** daily arrivals/departures on the main dashboard (`plans/Scrum Backlog & Sprints.md:11`) | **partial** | `src/components/dashboard/dashboard-page.tsx:71-80`; `src/components/dashboard/arrivals-detail.tsx:18-27`; `src/components/dashboard/departures-detail.tsx:18-27`; `src/hooks/use-dashboard-data.ts:70-75` | The dashboard already renders arrivals/departures panels, but they are backed by `guests.check_in_status`, not by a reservation query bounded to "today". This satisfies current dashboard visibility, but not a robust reservation-backed operational contract. | **Task 4** (reservation core) and **Task 7** (frontend migration to reservations). |
| **PRD Epic 1:** email/CSV parsing + idempotent upsert by Reservation ID (`plans/Dual-Architecture PRD.md:53-56`) | **missing** | `supabase/migrations/20260409044835_create_portfolio_schema.sql:98-110`; `src/types/database.ts:39-51` | `guests` has no dedicated reservation identifier, no external reference table, no upsert key for parsed bookings, and no staging/import seam. Duplicate-ingestion prevention cannot be implemented cleanly on the current data model. | **Task 4** (reservation core + external refs), **Task 6** (import/idempotency path). |
| **PRD Epic 3:** lightweight CRM with guest history, contact info, and special requests (`plans/Dual-Architecture PRD.md:63-67`) | **partial** | `supabase/migrations/20260409044835_create_portfolio_schema.sql:98-126`; `src/types/database.ts:39-61` | The repo has `guests` and `guest_requests`, but `guests` stores per-stay booking-like fields (`eta`, `etd`, `room_id`, `check_in_status`) rather than a reusable guest identity/history model. It also lacks contact fields entirely. `guest_requests` can store notes, but not true cross-stay guest history. | **Task 1** (contract boundary), **Task 4** (reservation core), **Task 5** (child linkage), **Task 6** (migration/backfill strategy). |
| **Track A / Track B dual-track readiness** (`plans/Dual-Architecture PRD.md:15-41`; `plans/Scrum Backlog & Sprints.md:30-33`) | **missing** | `src/hooks/use-dashboard-data.ts:38-50`; `package.json:12-45`; `glob("src/api/**") => no files`; `glob("prisma/**") => no files` | Track A exists only as a direct Supabase client + SQL schema. Track B scaffolding (Node backend, Prisma schema mirror, auth/provider replacement, repository parity) is not implemented. Shared frontend portability is not yet established. | **Task 9**, **Task 10**, **Task 11**. |

## 4. Current Schema Fitness Assessment

### 4.1 What the current schema is good at

Direct evidence shows the current schema supports a **read-heavy hospitality dashboard**:
- `properties` and `rooms` model physical inventory and occupancy-oriented room status (`supabase/migrations/20260409044835_create_portfolio_schema.sql:62-89`).
- `guests` stores booking-like display data such as `guest_name`, `eta`, `etd`, `check_in_status`, `booking_source`, and `guest_count` (`supabase/migrations/20260409044835_create_portfolio_schema.sql:98-110`).
- `guest_requests` and `maintenance_issues` support request and maintenance display panels (`supabase/migrations/20260409044835_create_portfolio_schema.sql:119-145`).
- `useDashboardData()` fetches those exact five tables and computes arrivals, departures, occupancy, and maintenance totals for the UI (`src/hooks/use-dashboard-data.ts:38-50`, `:57-92`).

### 4.2 Why it is not Sprint 1 / PMS sufficient

The same evidence shows the current schema is **not** a reservation-centric PMS foundation:
- There is **no `reservations` table** in the live schema (`supabase/migrations/20260409044835_create_portfolio_schema.sql:62-152`).
- The frontend type contract also has no reservation entity (`src/types/database.ts:1-84`).
- `guests` is acting as both person-ish data and booking-ish data, which collapses guest identity and reservation lifecycle into one row shape (`src/types/database.ts:39-51`; `supabase/migrations/20260409044835_create_portfolio_schema.sql:98-110`).
- There is no provider-edge model for external reservation IDs, listing aliases, account ownership, or idempotent import linkage.
- There is no repository seam for dual-track frontend portability; runtime data access is hard-coded to Supabase (`src/hooks/use-dashboard-data.ts:38-50`; `src/lib/supabase.ts:1-6`).

### 4.3 Verdict

**Current conclusion:** the implemented repo is **dashboard-sufficient but PMS-insufficient**.

Evidence:
- Dashboard sufficiency: current hook + dashboard components render arrivals, departures, occupancy, and maintenance surfaces from the five current tables (`src/hooks/use-dashboard-data.ts:38-50`, `:57-92`; `src/components/dashboard/dashboard-page.tsx:52-100`).
- PMS insufficiency: Sprint 1 and PRD require reservation-first ingestion, repository abstraction, auth boundaries, and Track B parity that do not exist in the current codebase (`plans/Scrum Backlog & Sprints.md:7-11`, `:26-33`; `plans/Dual-Architecture PRD.md:15-41`, `:51-67`).

## 5. Reusable vs Under-Modeled vs Missing Components

| Component | Classification | Evidence | Why |
|---|---|---|---|
| `properties` | **reusable** | `supabase/migrations/20260409044835_create_portfolio_schema.sql:62-70`; `src/types/database.ts:1-9` | Stable physical asset grouping already exists and is used in dashboard metrics. |
| `rooms` | **reusable** | `supabase/migrations/20260409044835_create_portfolio_schema.sql:79-89`; `src/types/database.ts:20-30` | Canonical room inventory exists and is already referenced by guests and maintenance. |
| `guests` | **under-modeled** | `supabase/migrations/20260409044835_create_portfolio_schema.sql:98-110`; `src/types/database.ts:39-51` | Stores booking display fields but lacks reservation identity, CRM contact/history fields, and a clean separation between guest and reservation concepts. |
| `guest_requests` | **under-modeled** | `supabase/migrations/20260409044835_create_portfolio_schema.sql:119-127`; `src/types/database.ts:53-61` | Useful operational child table, but it hangs off `guest_id` rather than an explicit reservation core and cannot by itself satisfy guest-history requirements. |
| `maintenance_issues` | **reusable** | `supabase/migrations/20260409044835_create_portfolio_schema.sql:136-145`; `src/types/database.ts:66-75` | Already property/room anchored and fits current operations scope without forcing reservation coupling. |
| Reservations core | **missing** | Absence from `supabase/migrations/20260409044835_create_portfolio_schema.sql:62-152` and `src/types/database.ts:1-84` | Sprint 1 requires reservations with strict foreign keys; current schema has none. |
| Ingestion / idempotency model | **missing** | `plans/Dual-Architecture PRD.md:53-56`; absence of reservation-ID fields in `guests` (`supabase/migrations/20260409044835_create_portfolio_schema.sql:98-110`) | No durable upsert key or provider-edge reference model exists. |
| Guest history / lightweight CRM | **under-modeled** | `plans/Dual-Architecture PRD.md:65-67`; `src/types/database.ts:39-61` | Requests/notes exist, but contact info and cross-stay history are missing. |
| Auth / UI boundary | **missing** | `plans/Scrum Backlog & Sprints.md:8`, `:33`; public read policies in `supabase/migrations/20260409044835_create_portfolio_schema.sql:72-77`, `:91-96`, `:112-117`, `:129-134`, `:147-152`; `package.json:12-45` | Runtime still assumes open demo reads; no auth UI/provider code exists. |
| TanStack Query / repository abstraction | **missing** | `plans/Scrum Backlog & Sprints.md:7`, `:30`; `plans/Dual-Architecture PRD.md:17`, `:28-30`; `src/hooks/use-dashboard-data.ts:38-50`; `package.json:12-45`; `glob("src/api/**") => no files` | No query layer, no interface folder, no branch-neutral repositories. |
| Track B backend scaffold / Prisma mirror | **missing** | `plans/Dual-Architecture PRD.md:24-38`; `plans/Scrum Backlog & Sprints.md:32`; `package.json:12-45`; `glob("prisma/**") => no files` | No Node backend scaffold, ORM schema, or mirror contract exists in repo. |

## 6. Branch Readiness Assessment (Track A vs Track B)

### 6.1 Track A: main branch / Supabase

**Status: partial**

What exists now:
- A Supabase PostgreSQL schema with five demo tables and RLS enabled (`supabase/migrations/20260409044835_create_portfolio_schema.sql:62-152`).
- A direct Supabase client created from Vite env vars (`src/lib/supabase.ts:1-6`).
- A dashboard hook that fetches directly from Supabase (`src/hooks/use-dashboard-data.ts:38-50`).

What is still missing for Sprint 1 readiness:
- Reservation-first schema
- TanStack Query foundation
- Repository/data-access abstraction
- Auth UI + Supabase Auth adapter boundary
- Ingestion/idempotency contract

### 6.2 Track B: sub-branch / Azure custom backend

**Status: missing**

PRD expectations call for Node.js + Express/Nest, Prisma/Drizzle, Clerk/Auth0, and a repository-compatible shared UI (`plans/Dual-Architecture PRD.md:24-40`). The current repo contains none of those runtime pieces:
- no `prisma/` directory
- no backend scaffold files
- no Node backend dependency surface in `package.json:12-45`
- no frontend repository seam to swap data sources

### 6.3 Combined branch-readiness conclusion

The repo currently represents **Track A dashboard runtime only**, and even that is still in a demo-oriented shape. It does **not** yet satisfy Sprint 1's "Great Split" objective of a shared frontend with both branch foundations (`plans/Scrum Backlog & Sprints.md:26-33`).

## 7. Final Verdict

1. **The current schema is reusable as a dashboard baseline, not as a Sprint 1 reservation platform.**
2. **`properties`, `rooms`, and `maintenance_issues` are the strongest reusable assets.**
3. **`guests` and `guest_requests` are under-modeled for a reservation-first PMS and guest-history workflow.**
4. **The most important missing foundation is the reservation / provider-edge / import-idempotency layer.**
5. **The frontend is still tightly coupled to Supabase and therefore fails Story-01 and dual-track branch portability.**
6. **The current runtime is explicitly not auth-ready for Story-02.**
7. **Story-05 exists only in a guest-status-based dashboard form, not as a reservation/date-driven daily operations contract.**

## 8. Recommended Follow-On Tasks (by plan task number)

| Plan task | Why this audit says it must exist next |
|---|---|
| **Task 1** | Needed to codify the additive reservation-centric contract without destroying the dashboard-compatible tables. |
| **Task 4** | Needed because the current schema has no reservation core, no external refs, and no allocation model. |
| **Task 5** | Needed because `guest_requests` currently hangs off `guest_id` rather than a canonical reservation workflow. |
| **Task 6** | Needed because PRD ingestion/idempotency cannot be satisfied on the current `guests` shape. |
| **Task 7** | Needed because Story-05 must move from guest-status UI slices to reservation-backed dashboard reads while preserving current KPI semantics. |
| **Task 9** | Needed because Story-01 is currently entirely absent: no repository layer, no TanStack Query, no `api/` abstraction. |
| **Task 10** | Needed because Track B's Node/Prisma scaffold is completely absent. |
| **Task 11** | Needed because Story-02 auth is missing and current RLS policies are still public-demo oriented. |

## 9. Summary Table

| Area | Primary files | Key finding |
|---|---|---|
| Current live schema | `supabase/migrations/20260409044835_create_portfolio_schema.sql:62-152` | Only five dashboard-oriented tables exist today. |
| Frontend type contract | `src/types/database.ts:1-84` | Frontend mirrors the same five entities; no reservations type exists. |
| Runtime data access | `src/hooks/use-dashboard-data.ts:38-50`; `src/lib/supabase.ts:1-6` | Runtime is directly coupled to Supabase table reads. |
| Dashboard arrivals/departures | `src/components/dashboard/dashboard-page.tsx:71-80`; `arrivals-detail.tsx:18-27`; `departures-detail.tsx:18-27` | UI exists, but it is guest-status-based rather than reservation/date-driven. |
| Ingestion/idempotency | `plans/Dual-Architecture PRD.md:53-56` vs current schema | Required by PRD, unsupported by current tables. |
| Guest history / CRM | `plans/Dual-Architecture PRD.md:65-67` vs `src/types/database.ts:39-61` | Current guest model is booking-shaped, not true history/contact-aware CRM. |
| Shared frontend portability | `plans/Scrum Backlog & Sprints.md:7`, `:30`; `package.json:12-45` | No TanStack Query or repository abstraction exists. |
| Track B readiness | `plans/Dual-Architecture PRD.md:24-38`; `glob("prisma/**") => no files` | Track B is planning-only, not implemented. |
