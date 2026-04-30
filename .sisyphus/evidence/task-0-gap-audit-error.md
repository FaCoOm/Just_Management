# Task 0 False-Positive Sufficiency Check

## Purpose

This file records the negative checks for Task 0 so downstream tasks do not accidentally treat the current schema as already Sprint 1-complete.

## Checks

| Unsupported claim to reject | Result | Evidence |
|---|---|---|
| "The current `guests` table already satisfies a real reservations core." | **Rejected** | The live schema contains `guests` but no `reservations`, `reservation_external_refs`, or `reservation_room_allocations` (`supabase/migrations/20260409044835_create_portfolio_schema.sql:98-110`, and absence from `:62-152`). |
| "The current repo already supports PRD ingestion idempotency." | **Rejected** | PRD requires upsert-by-Reservation-ID (`plans/Dual-Architecture PRD.md:53-56`), but the current `guests` shape has no reservation identifier field (`supabase/migrations/20260409044835_create_portfolio_schema.sql:98-110`; `src/types/database.ts:39-51`). |
| "The current `guests` + `guest_requests` tables already provide lightweight CRM with guest history and contact info." | **Rejected** | PRD requires guest history, contact info, and special requests (`plans/Dual-Architecture PRD.md:65-67`), but current `Guest` has no contact fields and is per-stay shaped (`src/types/database.ts:39-61`). |
| "Story-01 is already implemented because the app uses Supabase." | **Rejected** | Story-01 requires a repository abstraction (`plans/Scrum Backlog & Sprints.md:7`), but runtime data access is direct `supabase.from(...)` in `useDashboardData()` (`src/hooks/use-dashboard-data.ts:38-50`), with no `src/api/` files and no TanStack Query dependency (`package.json:12-45`). |
| "Story-02 is already covered by current RLS." | **Rejected** | Current policies are public read demo policies (`supabase/migrations/20260409044835_create_portfolio_schema.sql:72-77`, `:91-96`, `:112-117`, `:129-134`, `:147-152`), while Sprint 1 requires authentication UI and branch-aware auth wiring (`plans/Scrum Backlog & Sprints.md:8`, `:33`; `plans/Dual-Architecture PRD.md:20-21`, `:36-38`). |
| "Story-05 is fully done because arrivals/departures panels exist." | **Rejected** | Panels do exist (`src/components/dashboard/dashboard-page.tsx:71-80`), but they filter guest status, not reservation data constrained to today's date (`src/components/dashboard/arrivals-detail.tsx:18-27`; `src/components/dashboard/departures-detail.tsx:18-27`). |
| "Track B is already scaffolded in the repo." | **Rejected** | PRD calls for Node + Prisma + auth replacement (`plans/Dual-Architecture PRD.md:24-40`), but `glob("prisma/**")` returned no files and `package.json:12-45` contains no matching backend/ORM dependencies. |

## Outcome

Task 0 passes the false-positive check only if downstream work treats the current repo as:

- **usable for the current dashboard**, and
- **insufficient for Sprint 1 PMS, ingestion, auth, repository abstraction, and Track B readiness**.
