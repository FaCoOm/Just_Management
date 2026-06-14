# Reservation Status Propagation Analysis

## 1. Scope and Boundaries

This document inspects the current Track B implementation for reservation creation, reservation ingestion, Floor Plan room status, dashboard occupancy, and availability status propagation. It documents observed behavior only; it does **not** apply a fix, change schema, add migrations, or modify runtime source.

Evidence covers the frontend reservation page, repository layer, page hooks, Express API handlers, Prisma schema, reservation ingest service, Floor Plan page, dashboard summary endpoint, and availability page. The analysis excludes Supabase/Track A runtime paths because the project knowledge base identifies the current runtime path as Track B REST-only.

## 2. Symptom Being Investigated

The reported symptom is that reservations can be created or ingested, but the result does not register as an updated room status in other pages such as the Floor Plan, and does not consistently update headline occupancy-rate surfaces.

The source inspection supports that symptom: reservation writes persist to `reservations`, but the runtime paths do not write `rooms.status` (`backend/src/index.ts:606-676`, `backend/src/ingest/services/reservations.ts:267-383`). The Floor Plan and headline dashboard occupancy use `rooms.status` directly (`src/components/rooms/rooms-page.tsx:284-307`, `backend/src/index.ts:548-590`).

## 3. Two Sources of Truth Exist Today

The current setup has two separate sources for “occupied” state.

| Source | Where Stored/Computed | Used By | Propagation Behavior |
|---|---|---|---|
| `rooms.status` | `rooms.status String @default("Vacant")` in `backend/prisma/schema.prisma:32-53` | Floor Plan cards, Rooms page occupancy, dashboard headline/per-property KPI | Not updated by reservation create/ingest runtime paths. |
| Reservation date overlap | Computed from `reservations`, `primary_room_id`, and `reservation_room_allocations` in `backend/src/index.ts:271-324` | Dashboard `occupancySeries`, `/api/stats/occupancy` | Reflects reservations by read-time calculation. |

This means pages reading `rooms.status` can be stale while components reading reservation-overlap calculations can show fresher occupancy.

## 4. Reservation Create Trace

### 4.1 Frontend form and mutation

Manual creation starts in the reservations page. `onManualCreate` builds a `ReservationCreateInput` and calls `reservationMutation.mutate(...)` (`src/components/reservations/reservations-page.tsx:721-739`). The mutation calls `repositories.reservations.create(input)` (`src/components/reservations/reservations-page.tsx:691-698`).

The REST adapter sends the write to the backend with `postJson("/api/reservations", input)` (`src/lib/repositories/rest-repositories.ts:147-150`).

### 4.2 Cache invalidation after create

On success, the mutation invalidates `dashboardKeys.reservations` and `dashboardKeys.all` (`src/components/reservations/reservations-page.tsx:691-698`). Query keys define `dashboardKeys.rooms`, `dashboardKeys.reservations`, and `dashboardKeys.all` separately (`src/lib/query-keys.ts:4-18`).

Direct evidence: the create success path does **not** explicitly invalidate `dashboardKeys.rooms` (`src/components/reservations/reservations-page.tsx:691-698`, `src/lib/query-keys.ts:4-18`). Since Floor Plan data reads from the rooms query, it is not explicitly refreshed as a room-status surface after reservation creation.

### 4.3 Page data shape

`useReservationsPageData()` loads properties, rooms, and reservations, then derives legacy guest rows using `reservations.map(toDashboardGuest)` (`src/hooks/use-page-data.ts:54-86`). The mapper converts reservation fields into guest-compatible fields, including `primary_room_id` into `room_id` (`src/hooks/use-dashboard-data.ts:52-67`).

This mapping helps the reservations table display reservation data, but it does not mutate room records or room status.

### 4.4 Backend POST handler

The backend POST handler for `/api/reservations` validates input, checks property existence, optionally checks the supplied room, then creates a reservation (`backend/src/index.ts:606-676`). Its only room touch is read-only validation via `prisma.rooms.findFirst(...)` for `primary_room_id` (`backend/src/index.ts:649-655`). The write is `prisma.reservations.create(...)` (`backend/src/index.ts:657-674`).

Direct evidence: this handler contains no `rooms.update*` call and therefore does not set `rooms.status` after creating a reservation (`backend/src/index.ts:606-676`).

## 5. Reservation Ingest Trace

The ingest route dispatches reservation upload work into the ingest service (`backend/src/ingest/routes.ts:227-260`). The service creates or updates import rows (`backend/src/ingest/services/reservations.ts:146-175`), updates existing reservations (`backend/src/ingest/services/reservations.ts:267-316`), creates or updates allocation rows (`backend/src/ingest/services/reservations.ts:318-337`), and creates new reservations plus external refs and allocations (`backend/src/ingest/services/reservations.ts:342-383`).

The ingest path writes `reservations`, `reservation_external_refs`, `reservation_room_allocations`, `provider_reservation_import_rows`, `sync_dead_letters`, and `sync_runs` (`backend/src/ingest/services/reservations.ts:267-425`). It does not update `rooms.status`.

Direct evidence from backend search: `backend/src` had no matches for runtime `rooms.status`, `prisma.rooms.update`, or `rooms.updateMany` in the ref-verification pass. The only `prisma.rooms.update(...)` found was in a seed script (`backend/scripts/seed-rooms-sot.ts:173-198`), which is not the runtime API/ingest path.

## 6. Schema Reality

### 6.1 Status fields are free-form strings

`rooms.status` is defined as a plain string with default `"Vacant"` (`backend/prisma/schema.prisma:32-53`). `reservations.status` is defined as a plain string with default `"pending"`; `primary_room_id` is nullable; and the reservation has a relation to allocation rows (`backend/prisma/schema.prisma:222-256`).

`reservation_room_allocations` stores `reservation_id`, `room_id`, and allocation metadata (`backend/prisma/schema.prisma:287-302`). This supports multi-room occupancy calculations, but it is separate from `rooms.status`.

### 6.2 No trigger or Prisma middleware syncs statuses

The Prisma client is a plain `new PrismaClient()` export (`backend/src/lib/prisma.ts:1-3`). The verification pass found no `$use` or `$extends` middleware in `backend/`, so there is no ORM-level hook that propagates reservation writes into room status.

Migration inspection found only generic `set_updated_at_timestamp()` triggers in the initial migration (`backend/prisma/migrations/20260502000000_init_track_b/migration.sql:282-335`). No migration trigger was found that updates `rooms.status` from reservation inserts, updates, deletes, or allocation changes.

### 6.3 Seed scripts are not runtime propagation

The seed script `backend/scripts/seed.ts` creates rooms with seeded statuses via `prisma.rooms.createMany(...)` (`backend/scripts/seed.ts:40-63`). The source-of-truth room seed sync creates rooms with `status: "Vacant"` and updates room name/type only (`backend/scripts/seed-rooms-sot.ts:173-199`). Its strict-deletion guard checks reservation/allocation blockers, not room-status propagation (`backend/scripts/seed-rooms-sot.ts:74-80`, `backend/scripts/seed-rooms-sot.ts:250-272`).

These scripts explain where initial room statuses can come from, but they do not provide runtime reservation-to-room-status sync.

## 7. Floor Plan Read Path

The Floor Plan route is `/rooms`; `src/router.tsx` maps `path: "/rooms"` to `@/components/rooms/rooms-page` (`src/router.tsx:65-72`). The page labels itself as a floor-plan view across all properties (`src/components/rooms/rooms-page.tsx:333-343`).

The page groups rooms by property and floor (`src/components/rooms/rooms-page.tsx:108-118`, `src/components/rooms/rooms-page.tsx:269-281`). Room cards use `room.status` directly for status config, title, and display (`src/components/rooms/rooms-page.tsx:284-307`).

The page data hook fetches `properties`, `rooms`, and `reservations`, but returns `rooms` unchanged from `repos.rooms.getAll()` (`src/hooks/use-page-data.ts:54-86`). `useRoomsPageData()` passes those same rooms through for `/rooms` (`src/hooks/use-page-data.ts:93-96`).

The REST room repository calls `/api/rooms` (`src/lib/repositories/rest-repositories.ts:132-144`). The backend `/api/rooms` handler selects and returns the `rooms` table fields including `status` (`backend/src/index.ts:887-910`).

Conclusion: the Floor Plan does not derive room-card status from active reservations. It displays the `rooms.status` value returned by `/api/rooms`.

## 8. Dashboard and Availability Read Paths

### 8.1 Dashboard summary endpoint

The dashboard consumes `/api/dashboard/summary` through `dashboardRepo.getSummary(...)` (`src/lib/repositories/rest-repositories.ts:109-118`). The hook `useDashboardData(today)` calls `repos.dashboard.getSummary(today, 30)` and exposes the summary response to dashboard components (`src/hooks/use-dashboard-data.ts:90-129`).

The backend summary route returns properties, rooms, reservations, guests, metrics, totals, and `occupancySeries` (`backend/src/index.ts:396-600`).

### 8.2 Headline/per-property occupancy is status-based

Per-property occupancy in the dashboard summary counts rooms whose status is `"Occupied"`, `"Checked In"`, or `"Check-Out Pending"`, then computes `Math.round((occupiedRooms / totalRooms) * 100)` (`backend/src/index.ts:548-562`). Portfolio totals sum occupied rooms from metrics and compute `totals.occupancyRate` the same way (`backend/src/index.ts:569-590`).

This KPI path is tied to `rooms.status`. Since reservation creation and ingest do not update `rooms.status`, this path can remain stale after reservation writes.

### 8.3 Occupancy series is reservation-overlap-based

`buildOccupancySeries` counts occupied rooms by checking reservation date windows. It prefers `reservation_room_allocations`, falls back to `primary_room_id`, and finally uses a synthetic reservation id when no room id exists (`backend/src/index.ts:271-324`). This series is produced inside `/api/dashboard/summary` and exposed via `useDashboardData` (`backend/src/index.ts:396-600`, `src/hooks/use-dashboard-data.ts:90-129`).

This means the dashboard can contain both a stale headline occupancy KPI and a fresher reservation-driven series in the same response.

### 8.4 `/api/stats/occupancy` exists but is not the dashboard path

The backend also exposes `GET /api/stats/occupancy` (`backend/src/index.ts:759-869`). It uses the same day-by-day occupancy style: allocations first, then `primary_room_id`, then synthetic reservation id (`backend/src/index.ts:759-869`).

However, the dashboard hook uses `repos.dashboard.getSummary(...)`, not `statsRepo.getOccupancy(...)` (`src/hooks/use-dashboard-data.ts:90-129`, `src/lib/repositories/rest-repositories.ts:109-118`).

### 8.5 Availability page has a narrower reservation mapping

The Availability page computes room occupancy from reservations filtered by `res.primary_room_id === room.id` (`src/components/rooms/availability-page.tsx:63-96`). It does not use `reservation_room_allocations` in that page-level calculation (`src/components/rooms/availability-page.tsx:63-96`).

This is narrower than the backend `occupancySeries`, which supports allocation rows (`backend/src/index.ts:271-324`). Allocation-only reservations may therefore be represented in backend series but missed in the Availability page.

## 9. Risks, Gaps, and Unknowns

| Type | Finding | Evidence |
|---|---|---|
| Direct evidence | Manual reservation creation writes `reservations`, not `rooms.status`. | `backend/src/index.ts:606-676`, `backend/src/index.ts:657-674` |
| Direct evidence | Ingest writes reservations, refs, allocations, and import/sync records, not room status. | `backend/src/ingest/services/reservations.ts:267-425` |
| Direct evidence | Floor Plan cards read `room.status` directly. | `src/components/rooms/rooms-page.tsx:284-307` |
| Direct evidence | Dashboard headline/per-property occupancy reads `rooms.status`. | `backend/src/index.ts:548-590` |
| Direct evidence | Dashboard `occupancySeries` reads reservation windows and allocation rows. | `backend/src/index.ts:271-324` |
| Direct evidence | Availability page uses `primary_room_id` only. | `src/components/rooms/availability-page.tsx:63-96` |
| Direct evidence | No Prisma middleware or status trigger was found. | `backend/src/lib/prisma.ts:1-3`, `backend/prisma/migrations/20260502000000_init_track_b/migration.sql:282-335` |
| Strong inference | Reservation writes can update reservation-driven series while leaving Floor Plan and headline KPI stale. | Reservation write refs plus status-based read refs above. |
| Unknown | Whether users expect `rooms.status` to be staff-controlled housekeeping state or automatically derived occupancy state. | Product decision not encoded in current source. |

## 10. Surface Summary Table

| Surface | Source Used Today | Key File:Line | Staleness Mode |
|---|---|---|---|
| Manual reservation form | Writes `reservations` | `src/components/reservations/reservations-page.tsx:721-739`, `backend/src/index.ts:657-674` | Does not write room status. |
| Reservation ingest | Writes `reservations` + allocations | `backend/src/ingest/services/reservations.ts:267-383` | Does not write room status. |
| Floor Plan `/rooms` | Reads `rooms.status` | `src/components/rooms/rooms-page.tsx:284-307`, `backend/src/index.ts:887-910` | Reservation changes do not alter displayed status. |
| Dashboard headline KPI | Reads `rooms.status` | `backend/src/index.ts:548-590` | Can remain stale/default after reservation writes. |
| Dashboard occupancy series | Computes reservation overlap | `backend/src/index.ts:271-324` | More reservation-aware than headline KPI. |
| `/api/stats/occupancy` | Computes reservation overlap | `backend/src/index.ts:759-869` | Exists, but dashboard hook does not consume it. |
| Availability page | Computes by `primary_room_id` | `src/components/rooms/availability-page.tsx:63-96` | Misses allocation-only reservations. |

## 11. Out of Scope for This Document

No fix is implemented here. Specifically, this document does not:

- Add a `rooms.status` synchronization mechanism.
- Change the dashboard KPI formula.
- Change the Floor Plan to derive status from reservations.
- Add Prisma enums or database constraints.
- Add migrations or triggers.
- Add a room-status PATCH endpoint.
- Change cache invalidation after reservation creation.
- Modify the Availability page to use `reservation_room_allocations`.

Those are implementation decisions requiring a separate plan and tests. The current documented setup is: reservation records and room status are independent; Floor Plan and headline occupancy read room status; reservation-overlap surfaces read reservation data.
