# Plan: Manual Reservation Creation (2026-05-26)

## Goal
Wire `New Reservation` -> `Manual Entry` tab end-to-end on Track B so an operator can create a reservation against Azure PostgreSQL through the Express API.

## Out of scope
- Provider-side reconciliation, webhooks, multi-room allocation UI.
- Auth/RBAC; Sprint 2 owns this.
- Restyling the dialog beyond what is required to surface validation results.

## Scope
- Backend: add `POST /api/reservations` with strict validation, controlled errors, and minimal Prisma write.
- Frontend: replace disabled manual button with a working submit that calls the new endpoint, shows validation errors, refreshes data, and closes the dialog.
- Repository contract: add `create(input)` to `ReservationRepository` and REST implementation.
- Verification: type/build/db/verify steps and a manual smoke run via QA-safe payload.

## Surfaces

### Backend
- File: `backend/src/index.ts`
- Validation:
  - `property_id` required, must exist in `properties`.
  - `primary_room_id` optional, must belong to the property when provided.
  - `check_in_date`, `check_out_date` ISO `YYYY-MM-DD`, both valid, `check_in_date < check_out_date`.
  - `status` defaults to `pending`, must be in existing `RESERVATION_STATUSES` set.
  - `guest_name` required, trimmed, length <= 200.
  - `guest_phone`, `guest_email` optional, length-bounded, basic shape checks only.
  - `adult_count >= 1`, `child_count >= 0`, `infant_count >= 0`, `guest_count >= adult_count`.
  - `operational_notes`, `guest_notes` optional, length-bounded.
- Behavior:
  - Build payload using existing schema fields (no new columns).
  - Use `prisma.reservations.create({ data })` only.
  - Respond with the created reservation in the same shape as `GET /api/reservations/:id`.
  - Error responses: `400` for validation; `404` for missing property/room reference; `500` only for unexpected errors with safe message.

### Frontend repository
- File: `src/lib/repositories/types.ts`
- Add to `ReservationRepository`:
  ```ts
  create(input: ReservationCreateInput): Promise<Reservation>;
  ```
- New type `ReservationCreateInput` mirroring required backend fields, in `src/types/database.ts`.
- File: `src/lib/repositories/rest-repositories.ts`
- Implement `create` via `POST /api/reservations` and return parsed JSON.

### Frontend dialog
- File: `src/components/reservations/reservations-page.tsx`
- Replace disabled `Create Reservation` button with submit-aware form:
  - Controlled inputs for guest name, phone, email, property, room, dates, adults/child/infant, notes.
  - Use `useMutation` from `@tanstack/react-query` and the new repository factory.
  - On success: invalidate reservations query keys, close dialog, reset form, surface a small success line.
  - On validation error: render field-level error text from backend response.
  - Keep visible disabled state when required fields are missing.

### Tests / verification
- TypeScript build (frontend + backend) must remain clean.
- Manual smoke:
  - Pick a real property and (optionally) a real room from `/api/properties` and `/api/rooms?property_id=...`.
  - POST a minimal payload via curl, expect 201/200 with full reservation.
  - Refresh `/reservations` and confirm new row appears.

## Step-by-step

1. Backend - add typed validation helpers and `POST /api/reservations` route.
2. Backend - confirm new route does not break existing list/detail behavior; build and run `verify-ingestion` to confirm regression-free.
3. Frontend - add `ReservationCreateInput` type, update `ReservationRepository`, implement `create` in REST repo.
4. Frontend - rewrite manual reservation form to controlled state + mutation.
5. Frontend - run `typecheck`, then `build`, then manual smoke through dev server.
6. Update `docs/qa/implementation-qa-requirements-2026-05-26.md` if any QA case becomes obsolete.
7. Mark related tasks completed in the task store.

## Acceptance criteria

- `POST /api/reservations` accepts a valid payload and persists a row visible via `GET /api/reservations` and `/api/reservations/:id`.
- Manual tab submits successfully and the new reservation appears on `/reservations` after the mutation settles.
- Backend validation rejects bad payloads with `400` and a machine-readable error body.
- All build/typecheck/verify commands pass with evidence (exit 0, durations recorded).
- No new use of `any`, no defensive backward-compatibility code, no unrelated edits.

## Risks and mitigations

- Risk: schema mismatch between frontend type and Prisma model.
  - Mitigation: derive `ReservationCreateInput` from the same fields the API uses; add explicit checks in both layers.
- Risk: dialog regression for CSV upload tab.
  - Mitigation: keep CSV path untouched; only modify Manual Entry tab.
- Risk: reservation create leaks privileged fields.
  - Mitigation: backend returns the same shape as `GET /api/reservations/:id` with no passcodes or sync metadata.

## Team layout (for team-mode dispatch)

- Lead: Sisyphus (this session).
- Member 1 (`backend-impl`): backend route, validation, and tests. Category `unspecified-high`, skills: `backend-analysis`, `verification-before-completion`.
- Member 2 (`frontend-impl`): repository contract, REST adapter, dialog wiring. Category `visual-engineering`, skills: `verification-before-completion`.
- Member 3 (`verifier`): runs typecheck, builds, db verifications, ingest verify, manual smoke; reports evidence. Category `quick`, skills: `verification-before-completion`.
