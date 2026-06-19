# Implementation Plan: Operations Pipeline

## Overview

Wire stubbed operational flows to real REST mutations, introduce a folio-centric billing domain, and deliver reservation-linked stay-experience records. Implementation follows dependency order: schema migrations → backend services → route registrars → frontend repository contracts → REST adapters → hooks → component touchpoints → property tests → documentation.

Language: TypeScript (matching existing React 19 + Express + Prisma stack).


## Tasks

- [ ] 1. Prisma schema migrations (additive)
  - [-] 1.1 Add `stay_experiences` table and back-relations
    - Add `StayType` enum (`short_term`, `long_term`) and the `stay_experiences` model to `schema.prisma`
    - Add back-relation fields on `reservations`, `channels`, `reservation_external_refs`
    - Generate migration `add_stay_experiences`
    - Verify: `cd backend && npm run db:generate && npm run db:validate && npm run db:verify:migration`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8_

  - [~] 1.2 Make `guest_requests.guest_id` and `guest_requests.room_id` nullable
    - Change `guest_id` and `room_id` columns from `String` to `String?` in `guest_requests` model
    - Update relations to optional (`guests?`, `rooms?`)
    - Generate migration `guest_requests_nullable_guest_room` (ALTER COLUMN DROP NOT NULL only)
    - Verify: `cd backend && npm run db:generate && npm run db:validate && npm run db:verify:migration`
    - _Requirements: 3.2, 3.3_

  - [~] 1.3 Add folio domain tables (`folios`, `folio_line_items`, `folio_payments`)
    - Add `FolioStatus` enum (`open`, `finalized`, `settled`) and `FolioLineItemKind` enum (`charge`, `credit`)
    - Add `folios` model with unique `reservation_id`, `property_id` FK, status, currency, amounts, timestamps
    - Add `folio_line_items` model with kind, quantity, unit_amount, line_total, tax_rate, source
    - Add `folio_payments` model with method, amount, reference, received_at
    - Add back-relation on `reservations` and `properties`
    - Generate migration `add_folio_domain`
    - Verify: `cd backend && npm run db:generate && npm run db:validate && npm run db:verify:migration`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [~] 1.4 Add `folio_line_item_id` nullable column to `tax_export_items`
    - Add optional `folio_line_item_id String? @db.Uuid` field to existing `tax_export_items` model
    - Add relation to `folio_line_items` (onDelete: SetNull)
    - Add `@@index([folio_line_item_id])`
    - Add back-relation on `folio_line_items`
    - Generate migration `tax_export_items_add_folio_line_item`
    - Verify: `cd backend && npm run db:generate && npm run db:validate && npm run db:verify:migration`
    - _Requirements: 7.6_

- [~] 2. Checkpoint – Schema verified
  - Ensure all four migrations pass `db:generate`, `db:validate`, and `db:verify:migration`. Confirm `stay_registrations` and `guests` schemas are untouched. Ask the user if questions arise.

- [ ] 3. Backend services
  - [~] 3.1 Create `operationsEvents` emitter module
    - Create `backend/src/events/operations-events.ts`
    - Export typed `OperationsEmitter` class with `emitCheckoutCompleted` and `onCheckoutCompleted` methods
    - Export singleton `operationsEvents` instance
    - Define `CheckoutCompletedPayload` interface (`reservationId`, `propertyId`, `roomIds`, `occurredAt`)
    - _Requirements: 4.6_

  - [~] 3.2 Implement `StayExperienceService`
    - Create `backend/src/services/stay-experience-service.ts`
    - Implement `createStayExperience`: validate `reservation_id` exists (404 if not), create row, return 201
    - Implement `listStayExperiences`: filter by `property_id`, `reservation_id`, `stay_type`
    - Implement `getStayExperienceById`: return 200 or 404
    - Implement `updateStayExperience`: partial update, 200/400/404
    - Implement `deleteStayExperience`: 204/404
    - Follow existing validation pattern (explicit field checks, `{ error, errors: [{ field, message }] }`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

  - [~] 3.3 Modify `GuestRequestService` for reservation-anchored create
    - Update `createRequest` to accept nullable `guest_id`/`room_id`
    - Validate `reservation_id` existence on create (400/404 on missing)
    - Ensure `transitionStatus` enforces the full transition table from design state machine
    - Reconcile: route uses PATCH; no backend changes for existing transition/update/delete
    - _Requirements: 3.2, 3.3, 3.4, 3.7, 3.10_

  - [~] 3.4 Implement `CheckInService`
    - Create `backend/src/services/check-in-service.ts`
    - Implement `checkIn(prisma, reservationId)`: find reservation (404 if missing), wrap in `$transaction`
    - Find or create folio (reuse if exists), transition reservation to `checked_in`
    - Return `{ status: 200, body: { reservation, folio } }` on success, 409 if already checked-in
    - _Requirements: 4.1, 4.2, 4.3_

  - [~] 3.5 Implement `CheckOutService`
    - Create `backend/src/services/check-out-service.ts`
    - Implement `checkOut(prisma, reservationId)`: reject if reservation not in `checked_in`/`check_out_pending` (409)
    - Wrap in `$transaction`: compute balance from line_items + payments, update folio to `finalized`, transition reservation to `checked_out`
    - After transaction commit: emit `operationsEvents.emitCheckoutCompleted(payload)`
    - _Requirements: 4.4, 4.5, 4.6, 4.7_

  - [~] 3.6 Implement `FolioService`
    - Create `backend/src/services/folio-service.ts`
    - Implement `computeBalance(lineItems, payments)` pure function: `subtotal = sum(charges) - sum(credits)`, `paid = sum(payments)`, `balance = subtotal - paid`
    - Implement `postLineItem(prisma, folioId, input)`: validate fields, create line item (`line_total = quantity * unit_amount`), recompute and persist balance
    - Implement `recordPayment(prisma, folioId, input)`: validate amount > 0, create payment, recompute balance; if folio is `finalized` and balance reaches 0, transition to `settled`
    - Implement `getFolioById(prisma, id)`: include line_items + payments
    - Implement `listFolios(prisma, filters)`: filter by `reservation_id`, `property_id`
    - _Requirements: 7.1, 7.3, 7.4, 7.5_

  - [~] 3.7 Implement `DiningEventService`
    - Create `backend/src/services/dining-event-service.ts`
    - Implement `createDiningEvent(prisma, body)`: validate required fields (title, type, venue, date, start_time, end_time, guest_count, guest_name, property_id), return 400 with field errors on missing, 201 on success
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [~] 3.8 Implement `StaffService`
    - Create `backend/src/services/staff-service.ts`
    - Implement `createStaff(prisma, body)`: validate required fields (name, email, role, property_ids), return 400 with field errors on missing/invalid, 201 on success
    - Store `property_ids` as array field, `role` from `StaffRole` enum
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 4. Backend route registrars
  - [~] 4.1 Register stay-experience routes
    - Create `backend/src/routes/stay-experiences.ts` with `registerStayExperienceRoutes(app, prisma)`
    - Wire POST, GET (list), GET (/:id), PATCH (/:id), DELETE (/:id) to StayExperienceService
    - Register in `backend/src/index.ts`
    - _Requirements: 1.1, 1.7_

  - [~] 4.2 Register check-in/check-out routes
    - Create `backend/src/routes/check-in-out.ts` with `registerCheckInOutRoutes(app, prisma)`
    - Wire `POST /api/reservations/:id/check-in` → CheckInService
    - Wire `POST /api/reservations/:id/check-out` → CheckOutService
    - Register in `backend/src/index.ts`
    - Register `checkout.completed` listener that sets room(s) to housekeeping status via existing room-status logic
    - _Requirements: 4.1, 4.5, 4.6_

  - [~] 4.3 Register folio routes
    - Create `backend/src/routes/folios.ts` with `registerFolioRoutes(app, prisma)`
    - Wire GET /api/folios, GET /api/folios/:id, POST /api/folios/:id/line-items, POST /api/folios/:id/payments
    - Register in `backend/src/index.ts`
    - _Requirements: 7.3, 7.4, 7.5_

  - [~] 4.4 Register dining-event create route
    - Add `POST /api/dining-events` to existing dining-events route registration in `backend/src/index.ts`
    - Wire to DiningEventService.createDiningEvent
    - _Requirements: 5.4_

  - [~] 4.5 Register staff create route
    - Add `POST /api/staff` to existing staff route registration in `backend/src/index.ts`
    - Wire to StaffService.createStaff
    - _Requirements: 6.2_

  - [~] 4.6 Modify guest-requests route for reservation-anchored create
    - Update `POST /api/guest-requests` handler to pass through nullable `guest_id`/`room_id`
    - Ensure POST validates `reservation_id` via updated GuestRequestService
    - _Requirements: 3.4, 3.10_

- [~] 5. Checkpoint – Backend builds clean
  - Run `cd backend && npm run build`. Ensure no TypeScript errors. Ask the user if questions arise.

- [ ] 6. Frontend repository contracts and types
  - [~] 6.1 Add frontend model types to `database.ts`
    - Add `StayExperience`, `StayExperienceStayType`, `Folio`, `FolioStatus`, `FolioLineItem`, `FolioLineItemKind`, `FolioPayment` types to `frontend/src/types/database.ts`
    - Add `DiningEventCreateInput`, `StaffCreateInput`, `StayExperienceCreateInput`, `StayExperienceUpdateInput`, `FolioLineItemInput`, `FolioPaymentInput`, `CheckInOutResult` types
    - _Requirements: 1.2, 7.1, 7.3_

  - [~] 6.2 Extend repository contract interfaces in `types.ts`
    - Add `StayExperienceRepository` interface to `frontend/src/lib/repositories/types.ts`
    - Add `FolioRepository` interface
    - Add `CheckInOutRepository` interface
    - Extend `DiningEventRepository` with `create(input)` method
    - Extend `StaffRepository` with `create(input)` method
    - Add `stayExperiences`, `folios`, `checkInOut` to `RepositoryFactory`
    - _Requirements: 2.1, 4.1, 5.5, 6.5, 7.7_

  - [~] 6.3 Implement REST adapters in `rest-repositories.ts`
    - Implement `stayExperienceRepo`: getAll (with filters), getById, create, update (PATCH), delete
    - Implement `folioRepo`: getAll (with filters), getById, postLineItem, recordPayment
    - Implement `checkInOutRepo`: checkIn (POST), checkOut (POST)
    - Add `create` method to `diningEventRepo` (postJson to `/api/dining-events`)
    - Add `create` method to `staffRepo` (postJson to `/api/staff`)
    - Fix `guestRequestRepo.update` to use `patchJson` instead of `putJson` (contract reconciliation)
    - Wire new repos into `createRestRepositories()` return object
    - _Requirements: 2.1, 3.9, 4.1, 5.5, 6.5, 7.7_

- [ ] 7. Frontend hooks
  - [~] 7.1 Add query keys for new domains
    - Add `stayExperiences`, `stayExperiencesByProperty`, `folios`, `folioById`, `foliosByReservation` to `frontend/src/lib/query-keys.ts`
    - _Requirements: 2.1, 7.7_

  - [~] 7.2 Create `useStayRecordsData` and `useStayExperienceMutations` hooks
    - Create `frontend/src/hooks/use-stay-records-data.ts`
    - `useStayRecordsData(propertyId)`: fetch stay experiences + reservations, group by stay_type
    - `useStayExperienceMutations()`: create/update/delete mutations with cache invalidation
    - _Requirements: 2.1, 2.2_

  - [~] 7.3 Create `useCheckInOut` hook
    - Create `frontend/src/hooks/use-check-in-out.ts`
    - `useCheckInOut()`: checkIn/checkOut mutations invalidating reservations, rooms, folios, summary(today)
    - _Requirements: 4.1, 4.5_

  - [~] 7.4 Create `useFolioData` and `useFolioMutations` hooks
    - Create `frontend/src/hooks/use-folio-data.ts`
    - `useFolioData(reservationId)`: query folios by reservation
    - `useFolioMutations(folioId)`: postLineItem/recordPayment with cache invalidation
    - _Requirements: 7.3, 7.4, 7.7_

  - [~] 7.5 Extend `use-page-data.ts` with dining-event and staff create mutations
    - Add `useCreateDiningEvent()` mutation hook invalidating diningEvents key
    - Add `useCreateStaff()` mutation hook invalidating staff key
    - Add `useGuestRequestMutations()` with create/update/transition/delete
    - _Requirements: 3.9, 5.5, 6.5_

- [ ] 8. Frontend component touchpoints
  - [~] 8.1 Wire stay-records-tab to `useStayRecordsData`
    - Update `frontend/src/components/guests/stay-records-tab.tsx` to consume `useStayRecordsData`
    - Render short-term / long-term groupings with empty-state per group
    - _Requirements: 2.1, 2.2_

  - [~] 8.2 Wire check-in-out-page to `useCheckInOut` and folio display
    - Update `frontend/src/components/check-in-out/check-in-out-page.tsx`
    - Bind check-in/check-out buttons to hook mutations
    - Show folio summary panel using `useFolioData`
    - _Requirements: 4.1, 4.5, 7.7_

  - [~] 8.3 Wire guest-requests-tab controls to mutations
    - Update `frontend/src/components/guests/guest-requests-tab.tsx`
    - Bind create/list/update/transition/delete controls to `useGuestRequestMutations`
    - Ensure reservation-anchored create flow (no required guest_id/room_id)
    - _Requirements: 3.4, 3.7, 3.8, 3.9_

  - [~] 8.4 Add "New Event" dialog to dining-events-page
    - Update `frontend/src/components/dining-events/dining-events-page.tsx`
    - Add dialog form submitting via `useCreateDiningEvent` hook
    - _Requirements: 5.5_

  - [~] 8.5 Add "Add Staff" dialog to staff-roles-page
    - Update `frontend/src/components/admin/staff-roles-page.tsx`
    - Add dialog form with role + property assignment submitting via `useCreateStaff` hook
    - _Requirements: 6.5_

- [~] 9. Checkpoint – Frontend builds clean
  - Run `npm run typecheck` then `npm run build` from project root. Ensure no errors. Ask the user if questions arise.

- [ ] 10. Property-based tests
  - [~] 10.1 Write property test: stay-experience create requires existing reservation
    - **Property 1: Stay-experience create requires an existing reservation**
    - Generate random payloads with valid/invalid reservation_ids; assert 404 on missing, 201+row on valid
    - **Validates: Requirements 1.7, 1.1**

  - [~] 10.2 Write property test: stay-experience preserves references and free-form content
    - **Property 2: Stay-experience preserves references and free-form content**
    - Generate payloads with unicode strings, empty strings, null optionals; assert byte-for-byte echo
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5**

  - [~] 10.3 Write property test: stay-records grouping partitions without loss
    - **Property 3: Stay Records grouping partitions without loss**
    - Generate random sets of stay-experience rows; assert short-term ∪ long-term = input, disjoint
    - **Validates: Requirements 2.1**

  - [~] 10.4 Write property test: guest-request create is reservation-anchored with optional guest/room
    - **Property 4: Guest request create is reservation-anchored with optional guest/room**
    - Generate payloads with null/non-null guest_id and room_id; assert success when reservation exists
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.10**

  - [~] 10.5 Write property test: guest-request status transitions obey transition table
    - **Property 5: Guest request status transitions obey the transition table**
    - Generate all (currentStatus, targetStatus) pairs; assert accept/reject matches allowed edges
    - **Validates: Requirements 3.7**

  - [~] 10.6 Write property test: check-in yields exactly one folio
    - **Property 6: Check-in yields exactly one folio and a checked-in reservation**
    - Call checkIn 1–N times on same reservation; assert exactly one folio, reservation in checked_in
    - **Validates: Requirements 4.1, 4.2, 4.3, 7.2**

  - [~] 10.7 Write property test: check-out finalizes folio and transitions reservation
    - **Property 7: Check-out finalizes the folio and transitions the reservation**
    - Generate random line-item/payment sequences; assert folio finalized with correct totals, reservation checked_out
    - **Validates: Requirements 4.4, 4.5**

  - [~] 10.8 Write property test: check-out rejected outside checked-in lifecycle
    - **Property 8: Check-out is rejected outside the checked-in lifecycle**
    - Generate reservations in each non-checked-in status; assert 409 and no state change
    - **Validates: Requirements 4.7**

  - [~] 10.9 Write property test: folio balance equals derived ledger formula
    - **Property 9: Folio balance equals the derived ledger formula**
    - Generate random sequences of charges, credits, payments; assert balance = charges - credits - payments after each mutation
    - **Validates: Requirements 7.5**

  - [~] 10.10 Write property test: settled folios stay settled at zero balance
    - **Property 10: Settled folios stay settled at zero balance**
    - Generate finalized folios; pay to zero; assert settled status persists
    - **Validates: Requirements 7.1, 7.5**

  - [~] 10.11 Write property test: dining-event create validates required fields
    - **Property 11: Dining-event create validates required fields then persists**
    - Generate payloads with random missing fields; assert 400 on missing, 201+echo on complete
    - **Validates: Requirements 5.3, 5.4**

  - [~] 10.12 Write property test: staff create requires role and preserves assignment
    - **Property 12: Staff create requires role and preserves assignment**
    - Generate payloads with missing role/fields; assert 400 on missing, 201 + preserved role/property_ids on valid
    - **Validates: Requirements 6.2, 6.3, 6.4**

  - [~] 10.13 Write property test: tax-export totals match folio line items with fallback
    - **Property 13: Tax-export totals match folio line items with reservation fallback**
    - Generate reservations with/without finalized folios; assert export totals match folio or fallback path
    - **Validates: Requirements 7.6**

- [ ] 11. Operations documentation
  - [~] 11.1 Create operations-pipeline documentation under `docs/`
    - Create `docs/operations-pipeline.md` documenting the full pipeline: stay experiences, guest requests, check-in/out, folio domain, dining events, staff, tax-export migration path
    - Include API surface table, state machines, data flow descriptions
    - Reference requirements and design decisions
    - _Requirements: 8.1_

- [~] 12. Final checkpoint – Full verification
  - Run full verification: `cd backend && npm run build && npm run db:generate && npm run db:validate && npm run db:verify:migration` then `npm run typecheck && npm run build` from frontend root. Ensure all passes. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at schema, backend, and frontend layers
- Property tests validate universal correctness properties from the design document
- The 4 migrations must be applied in order: `add_stay_experiences` → `guest_requests_nullable_guest_room` → `add_folio_domain` → `tax_export_items_add_folio_line_item`
- Backend verification: `cd backend && npm run build`, `npm run db:generate`, `npm run db:validate`, `npm run db:verify:migration`
- Frontend verification: `npm run typecheck`, `npm run build`
- `stay_registrations` and `guests` tables must remain untouched throughout

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "3.1"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4", "3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "3.5", "3.6", "3.7", "3.8"] },
    { "id": 5, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["6.2"] },
    { "id": 8, "tasks": ["6.3", "7.1"] },
    { "id": 9, "tasks": ["7.2", "7.3", "7.4", "7.5"] },
    { "id": 10, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5"] },
    { "id": 11, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "10.10", "10.11", "10.12", "10.13", "11.1"] }
  ]
}
```
