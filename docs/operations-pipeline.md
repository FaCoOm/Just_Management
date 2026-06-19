# Operations Pipeline

The operations pipeline is the REST/Prisma/Azure path for reservation-linked stay records, guest requests, check-in/out, folios, dining events, staff creation, and tax export. The frontend continues to use `createRestRepositories()` only; Prisma access stays behind Express services and routes.

## API surface

| Domain | Endpoint | Purpose |
|---|---|---|
| Stay experiences | `POST /api/stay-experiences` | Create a reservation-linked stay-experience record after validating `reservation_id`. |
| Stay experiences | `GET /api/stay-experiences` | List by `property_id`, `reservation_id`, or `stay_type`. |
| Stay experiences | `GET /api/stay-experiences/:id` | Read one stay-experience record. |
| Stay experiences | `PATCH /api/stay-experiences/:id` | Partially update stay experience metadata/content. |
| Stay experiences | `DELETE /api/stay-experiences/:id` | Delete a stay-experience record. |
| Guest requests | `POST /api/guest-requests` | Create reservation-anchored request; `guest_id` and `room_id` are optional. |
| Guest requests | `PATCH /api/guest-requests/:id` | Update request fields through the REST repository contract. |
| Guest requests | `PATCH /api/guest-requests/:id/status` | Apply the allowed request status state machine. |
| Guest requests | `DELETE /api/guest-requests/:id` | Delete a request. |
| Check-in/out | `POST /api/reservations/:id/check-in` | Transition reservation to `checked_in`; create or reuse one folio. |
| Check-in/out | `POST /api/reservations/:id/check-out` | Finalize folio, transition reservation to `checked_out`, emit housekeeping signal. |
| Folios | `GET /api/folios` | List folios by `reservation_id` or `property_id`. |
| Folios | `GET /api/folios/:id` | Read folio with line items and payments. |
| Folios | `POST /api/folios/:id/line-items` | Post charge/credit and recompute persisted totals. |
| Folios | `POST /api/folios/:id/payments` | Record payment, recompute totals, settle finalized zero-balance folios. |
| Dining events | `POST /api/dining-events` | Create a dining/event booking after required-field validation. |
| Staff | `POST /api/staff` | Create staff with role and `property_ids`. |

## Data flow

Stay experiences are stored in `stay_experiences`, linked to `reservations`, and optionally linked to `channels` and `reservation_external_refs`. The Stay Records UI reads them through `stayExperiences` REST repository methods and groups rows into `short_term` and `long_term` views without mutating legacy `stay_registrations`.

Guest requests now require `reservation_id` on create while keeping `guest_id` and `room_id` nullable. The request lifecycle accepts only these transitions: `open → assigned|in_progress|closed`, `assigned → in_progress|closed`, `in_progress → fulfilled|closed`, `fulfilled → closed|reopened`, `closed → reopened`, and `reopened → assigned|in_progress|closed`.

Check-in validates the reservation, creates or reuses exactly one folio, then marks the reservation `checked_in`. Check-out is allowed only from `checked_in` or `check_out_pending`; it computes folio totals, finalizes the folio, marks the reservation `checked_out`, and emits `checkout.completed` for room/housekeeping follow-up.

Folios are the billing source of truth. `computeBalance` derives `subtotal_amount = charges - credits`, `paid_amount = payments`, and `balance_amount = subtotal - paid`; finalized folios become `settled` when payment brings the balance to zero.

Tax export now has an additive folio migration path: finalized or settled folios export from `folio_line_items` and stamp `folio_line_item_id`; reservations without folios keep the existing reservation-derived fallback.

## Verification

Correctness is covered by `backend/test/operations-pipeline-services.test.ts`, which contains 13 `fast-check` property tests matching `design_plan.md` Properties 1–13 with 100 generated runs each. Standard verification remains backend build/tests/schema checks plus frontend typecheck/tests/build.
