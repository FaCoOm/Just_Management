# Reservation-Derived Occupancy / Floor Plan QA Handoff

## Scope
Verify that active reservations now drive occupancy metrics and Floor Plan room status, even when `rooms.status` is stale. Do not test unrelated availability-page behavior unless you see an obvious regression.

## Preconditions
- Backend: Track B Express API on `http://localhost:3001`.
- Frontend: Vite app on `http://localhost:5173` with `VITE_TRACK=B`.
- Use existing local/dev DB data; do not mutate production data.

## API QA
1. Hit `GET http://localhost:3001/health`.
   - Expected: HTTP 200 JSON health response.
2. Hit `GET http://localhost:3001/api/reservations`.
   - Expected: HTTP 200 array.
   - Check at least one reservation object includes `reservation_room_allocations` field, even if empty.
3. Hit `GET http://localhost:3001/api/dashboard/summary`.
   - Expected: HTTP 200.
   - Confirm `today.occupiedRooms`, `today.totalRooms`, `today.occupancyRate`, and per-property occupancy fields are present.
   - If active reservations exist for today, occupied count should reflect reservation room allocations / `primary_room_id`, not stale `rooms.status`.

## UI QA
1. Open `http://localhost:5173/rooms`.
   - Expected: Floor Plan route renders without crash.
2. Inspect visible room cards.
   - Expected: rooms with active reservations display occupied/check-in style status derived from reservation dates.
   - Expected: rooms with maintenance / attention status still show attention state; reservation derivation must not hide that.
   - Expected: rooms with no active reservation remain vacant/available.
3. Open dashboard home route `http://localhost:5173/`.
   - Expected: dashboard renders; occupancy KPI does not show impossible stale-zero when active reservations exist.

## Evidence To Return
- Commands/URLs tested.
- HTTP status for each API call.
- One screenshot or accessibility snapshot of `/rooms`.
- Console errors, if any.
- Any mismatch between reservation data and displayed Floor Plan status.

## Known Non-Blocking Context
- Backend `npm run build` may fail locally on Windows with Prisma DLL `EPERM` rename lock; `npx tsc` and backend tests already passed.
- Availability page allocation-only behavior is out of scope for this change.
