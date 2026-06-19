# Operations Pipeline

## Purpose

The operations pipeline connects reservation-led hotel operations to real REST mutations. `reservations` remain the booking source of truth; `guests` and `stay_registrations` remain compatibility/tenant surfaces.

## Data Flow

1. Stay records read `stay_experiences` joined to `reservations`, split by `short_term` and `long_term`.
2. Guest requests are anchored by `reservation_id`; `guest_id` and `room_id` are optional compatibility links.
3. Check-in creates or reuses one `folio` for the reservation, then moves the reservation to `checked_in`.
4. Check-out finalizes the folio, moves the reservation to `checked_out`, then emits `checkout.completed` for housekeeping room-status work.
5. Folio line items and payments update persisted subtotal, paid, and balance amounts.
6. Dining events and staff use create endpoints backed by service-level validation.
7. Tax export can link to `folio_line_items` while retaining reservation-derived fallback behavior.

## API Surface

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/stay-experiences` | Create reservation-linked stay record |
| `GET` | `/api/stay-experiences` | List by property, reservation, or stay type |
| `GET` | `/api/stay-experiences/:id` | Read one stay record |
| `PATCH` | `/api/stay-experiences/:id` | Partially update stay record |
| `DELETE` | `/api/stay-experiences/:id` | Delete stay record |
| `POST` | `/api/reservations/:id/check-in` | Create/reuse folio and check in |
| `POST` | `/api/reservations/:id/check-out` | Finalize folio and check out |
| `GET` | `/api/folios` | List folios by reservation/property |
| `GET` | `/api/folios/:id` | Read folio with ledger |
| `POST` | `/api/folios/:id/line-items` | Add charge/credit |
| `POST` | `/api/folios/:id/payments` | Record payment |
| `POST` | `/api/dining-events` | Create dining/event booking |
| `POST` | `/api/staff` | Create staff member |

## State Machines

Guest request transitions: `open → assigned | in_progress | closed`, `assigned → in_progress | closed`, `in_progress → fulfilled | closed`, `fulfilled → closed | reopened`, `closed → reopened`, `reopened → assigned | in_progress | closed`.

Reservation operations: `pending/check_in_pending → checked_in`; `checked_in/check_out_pending → checked_out`. Check-out outside the checked-in lifecycle returns `409`.

Folio status: `open → finalized → settled`; payment to zero on a finalized folio settles it.

## Verification

Schema work: `cd backend && npm run db:generate && npm run db:validate && npm run db:verify:migration`.

Backend work: `cd backend && npm run build` plus operations service tests.

Frontend work: `npm run typecheck && npm run build` from the frontend workspace/root as configured.
