# Dashboard Completion, Tax-Export, and WithOne Integration Plan

## TL;DR

> **Quick Summary**: Complete every sidebar-promised dashboard page, add same-day checkout Tax-Export through WithOne Gmail + Google Sheets, and harden WithOne as future third-party integration boundary without building a full PMS/accounting platform.
>
> **Deliverables**:
> - 11 fully implemented routed dashboard pages.
> - Existing button gaps wired: Guests Export, Rooms Manage Room Types, Maintenance Log Issue.
> - New Tax & Compliance page plus per-reservation Tax-Export action plus scheduled export support.
> - Email parser registry for Airbnb, Booking.com, Agoda, and generic fallback.
> - Google Sheet row upsert writer using user-provided template/sheet ID.
> - Lean schema additions for configs, export jobs/items, page-specific operational data, and audit.
> - Frontend Vitest + backend Node test-runner infrastructure with TDD task flow.
> - ProviderConnector/WithOne adapter seam for future providers.
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 7 waves + final verification
> **Critical Path**: 1 → 4 → 8 → 14 → 21 → 29 → F1-F4

---

## Context

### Original Request
User requested complete implementation plan for other dashboard pages, a complete Tax-Export button based on an existing Google Sheet template, thorough plans for each current dashboard page, app implementation planning, and future third-party integrations mostly through WithOne unified API.

### Interview Summary
**Key Decisions**:
- All 11 missing sidebar pages must be fully implemented, not stubbed.
- Multi-property behavior is required throughout.
- Tax-Export primary default is same-day checkout: submission date `D` exports reservations whose `check_out` equals `D`.
- Tax-Export uses existing WithOne-linked Gmail connection.
- Sheet target is one shared user-provided Google Sheet for all listings/accounts.
- v1 parsers: Airbnb, Booking.com, Agoda, plus generic/pluggable fallback.
- Tax-Export UI includes dedicated Tax & Compliance page, per-reservation row action, and scheduled/automated runs.
- WithOne work is architecture prep only beyond Gmail/Sheets path.
- Tests: frontend Vitest, backend Node built-in test runner; set up infra first, then TDD.
- Schema: lean foundations first, expand per page.

**Research Findings**:
- Routed pages already implemented: `/`, `/reservations`, `/guests`, `/rooms`, `/maintenance`, `/settings/integrations`.
- Missing sidebar pages: Check-in / Check-out, VIP Guests, Room Types, Availability, Housekeeping, Dining & Events, Rate Manager, Billing & Invoices, Channel Distribution, Staff & Roles, Security & Access.
- Existing button gaps: Guests Export, Rooms Manage Room Types, Maintenance Log Issue.
- WithOne already exists under `backend/src/integrations/one/` and routes under `backend/src/routes/one.ts`.
- Existing provider-edge schema includes channels, external_accounts, channel_listings, reservation_external_refs, integration_connections, email_import_messages, sync_runs.
- Tax/export is greenfield: no tax fields, no export endpoints, Sheets path mostly read-only.
- Current architecture is Track B REST-only; do not revive Supabase runtime.

### Metis Review
**Identified Gaps (addressed)**:
- Timezone/cutoff: default to local property today, fallback `Asia/Ho_Chi_Minh`.
- Idempotency: use `reservation_id + checkout_date + confirmation_code`.
- Gmail parse ambiguity: route to `needs_review`, do not fail whole batch.
- Sheet collision: upsert rows by idempotency key, never blind append.
- Privacy: store Gmail message IDs and parsed fields; do not persist full raw email body by default.
- Scope fence: no full PMS/payments/accounting platform, no new live OTA provider integration beyond Gmail/Sheets pipeline.

### Planning Defaults
- RBAC default: minimal app-level roles `admin`, `manager`, `accountant`, `staff`, because README defers external auth. These roles only gate page/actions in this plan.
- Billing default: lean operational folio/invoice visibility only; no legal invoice issuance, payment processor, or accounting ledger.
- Staff default: staff directory and property assignment are internal dashboard records, not HR/payroll.
- Sheet default: one spreadsheet and one tab unless user-provided template requires multiple tabs.
- Tax formula default: Google Sheet template owns formulas; app exports parsed payment fields and audit metadata.

---

## Work Objectives

### Core Objective
Bring the app from a partially-routed operations dashboard to a complete multi-property hospitality management surface, while adding a reliable same-day Tax-Export workflow that enriches checkout reservations from OTA payment emails and writes them into a shared Google Sheet through WithOne.

### Concrete Deliverables
- Full routes and production page components for all 11 missing sidebar destinations.
- Tax & Compliance route/page, reservation row export action, scheduled export job support.
- Lean Prisma schema additions with migrations and backend routes.
- Frontend repository methods and hooks for all new pages and tax/export features.
- Test infrastructure and TDD coverage for parsers, services, routes, hooks, and critical UI states.
- WithOne ProviderConnector interface and Gmail/Sheets adapter boundary.

### Definition of Done
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] `cd backend && npm run build` passes.
- [ ] `cd backend && npm run db:generate` passes.
- [ ] `cd backend && npm run db:validate` passes.
- [ ] `cd backend && npm run db:verify:migration` passes.
- [ ] Frontend Vitest suite passes.
- [ ] Backend Node test suite passes.
- [ ] Every sidebar item lands on a real, non-placeholder page.
- [ ] Tax-Export same-day checkout run is idempotent and produces expected sheet row payloads under mocked WithOne.

### Must Have
- All 11 missing sidebar pages fully implemented.
- Multi-property filter/scope on every page.
- Tax-Export defaults to today's checkout date.
- Existing WithOne Gmail connection used; no frontend direct Gmail/Sheets calls.
- Sheet row upsert by idempotency key.
- `needs_review` state for ambiguous/missing parse data.
- TDD first for backend services/parsers/routes and frontend hooks/page states.
- Agent-executed QA scenarios for every task.

### Must NOT Have (Guardrails)
- Must NOT revive Supabase runtime adapter.
- Must NOT build full accounting/PMS/payments platform beyond page-specific lean needs.
- Must NOT add live Booking.com/Agoda/Airbnb API integrations beyond email parsing.
- Must NOT store raw full email body unless explicitly justified and redacted.
- Must NOT let frontend call Gmail/Sheets directly.
- Must NOT blindly append duplicate rows to Google Sheets.
- Must NOT implement placeholder pages for the 11 requested pages.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - all verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO complete test infra currently confirmed.
- **Automated tests**: TDD.
- **Frontend Framework**: Vitest + Testing Library where appropriate.
- **Backend Framework**: Node built-in test runner.
- **Flow**: RED failing test → GREEN minimal implementation → REFACTOR.

### QA Policy
Every task includes agent-executed QA scenarios. Evidence saved to `.omo/evidence/`.
- Frontend/UI: Playwright.
- API/Backend: Bash with curl and Node test commands.
- CLI/TUI: interactive_bash only if needed.
- Library/Module: Bash running `node --test` or Vitest.

---

## Execution Strategy

### Parallel Execution Waves

```text
Wave 1 (Foundation + tests): 1-7
Wave 2 (Shared data/schema/contracts): 8-13
Wave 3 (Front Office + Property pages): 14-20
Wave 4 (Revenue + Admin pages): 21-27
Wave 5 (Tax-Export backend): 28-34
Wave 6 (Tax UI + existing button gaps): 35-40
Wave 7 (Scheduler, observability, integration hardening): 41-45
Final Verification: F1-F4
```

### Dependency Matrix
- **1-7**: Wave 1 foundation has internal micro-dependencies but remains one foundation wave: 1 starts immediately; 2-5 depend on 1; 6-7 depend on 2/5. Executor should start each task as soon as its micro-blockers finish.
- **8-13**: blocked by 1-7; block page and tax work.
- **14-20**: blocked by 8-13; can run mostly parallel.
- **21-27**: blocked by 8-13; can run mostly parallel.
- **28-34**: blocked by 8-13; tax backend chain.
- **35-40**: blocked by relevant backend/page foundations.
- **41-45**: blocked by 28-40.
- **F1-F4**: blocked by all implementation tasks.

### Agent Dispatch Summary
- **Wave 1**: `quick`, `unspecified-high`, `deep`
- **Wave 2**: `deep`, `unspecified-high`
- **Wave 3**: `visual-engineering`, `unspecified-high`, `quick`
- **Wave 4**: `deep`, `unspecified-high`, `visual-engineering`
- **Wave 5**: `deep`, `ultrabrain`, `unspecified-high`
- **Wave 6**: `visual-engineering`, `quick`, `unspecified-high`
- **Wave 7**: `deep`, `unspecified-high`
- **FINAL**: `oracle`, `unspecified-high`, `unspecified-high`, `deep`

---

## TODOs

> Implementation + tests stay together. Labels use bare numbers only.

- [ ] 1. Test infrastructure and scripts

  **What to do**: Add frontend Vitest config/scripts and backend Node test-runner scripts. Create one failing smoke test per side, then make it pass.
  **Must NOT do**: Do not add Jest; do not skip tests in CI-like commands.
  **Recommended Agent Profile**: Category `quick`; Skills `none`.
  **Parallelization**: Wave 1; Can run in parallel: YES; Blocks 8-45; Blocked by None.
  **References**: `package.json` frontend scripts; `backend/package.json`; `vite.config.ts`; `src/main.tsx`; `backend/src/index.ts`.
  **Acceptance Criteria**: Frontend test script runs one passing test; backend Node test script runs one passing test; docs/scripts names are stable.
  **QA Scenarios**: Happy path: Bash run frontend test command and backend test command, expect exit 0, evidence `.omo/evidence/task-1-tests.txt`. Failure path: intentionally reference missing test file command, expect nonzero and clear error, evidence `.omo/evidence/task-1-missing-test-error.txt`.
  **Commit**: YES - `test(infra): add test runners`

- [ ] 2. Test fixtures and factories

  **What to do**: Create reusable frontend data factories and backend fixtures for two properties, rooms, reservations, confirmation codes, and provider refs.
  **Must NOT do**: Do not use production data or secrets.
  **Recommended Agent Profile**: Category `quick`; Skills `none`.
  **Parallelization**: Wave 1; Can run in parallel: YES; Blocks 8-45; Blocked by 1.
  **References**: `src/types/database.ts`; `backend/prisma/schema.prisma`; `src/hooks/use-page-data.ts`; `backend/src/ingest/normalizer.ts`.
  **Acceptance Criteria**: Fixtures cover at least 2 properties and 3 OTAs; fixtures import in both frontend/backend tests.
  **QA Scenarios**: Happy path: run fixture import tests, assert property count 2 and OTA count 3, evidence `.omo/evidence/task-2-fixtures.txt`. Failure path: duplicate confirmation-code fixture detects collision when expected, evidence `.omo/evidence/task-2-collision-error.txt`.
  **Commit**: YES - `test(fixtures): add hospitality test data`

- [ ] 3. Route inventory and sidebar contract test

  **What to do**: Add tests that assert every sidebar destination has a route and non-placeholder page by end-state; initial test may fail before pages land.
  **Must NOT do**: Do not remove sidebar items to make tests pass.
  **Recommended Agent Profile**: Category `quick`; Skills `none`.
  **Parallelization**: Wave 1; Can run in parallel: YES; Blocks 14-27; Blocked by 1.
  **References**: `src/router.tsx`; `src/components/app-sidebar.tsx`.
  **Acceptance Criteria**: Test enumerates 11 missing routes and fails until implemented; final run passes all.
  **QA Scenarios**: Happy path: after pages implemented, Vitest route/sidebar test shows 11/11 mapped, evidence `.omo/evidence/task-3-route-contract.txt`. Failure path: temporary unmatched route fixture produces clear missing-route assertion, evidence `.omo/evidence/task-3-route-missing-error.txt`.
  **Commit**: YES - `test(routes): lock sidebar route contract`

- [ ] 4. Backend test harness with mocked Prisma and WithOne ports

  **What to do**: Establish backend service tests using Node test runner, dependency-injected Prisma-like repositories, and mocked WithOne adapter.
  **Must NOT do**: Do not hit real database, Gmail, Sheets, or WithOne in unit tests.
  **Recommended Agent Profile**: Category `unspecified-high`; Skills `none`.
  **Parallelization**: Wave 1; Can run in parallel: YES; Blocks 28-34, 41-45; Blocked by 1-2.
  **References**: `backend/src/integrations/one/client.ts`; `backend/src/integrations/one/google/gmail.ts`; `backend/src/integrations/one/google/sheets.ts`; `backend/src/ingest/services/email.ts`.
  **Acceptance Criteria**: Backend can unit-test parser/service without network; mock captures requests and responses.
  **QA Scenarios**: Happy path: `cd backend && npm run test` passes mocked WithOne test, evidence `.omo/evidence/task-4-backend-mock.txt`. Failure path: mock configured to throw quota error and service maps it to retryable failure, evidence `.omo/evidence/task-4-quota-error.txt`.
  **Commit**: YES - `test(backend): add mocked integration harness`

- [ ] 5. Frontend page test harness

  **What to do**: Add frontend render helpers for router, query client, property context, and mocked REST repositories.
  **Must NOT do**: Do not render pages against live backend in unit tests.
  **Recommended Agent Profile**: Category `quick`; Skills `none`.
  **Parallelization**: Wave 1; Can run in parallel: YES; Blocks 14-27, 35-40; Blocked by 1-2.
  **References**: `src/main.tsx`; `src/router.tsx`; `src/hooks/use-page-data.ts`; `src/lib/repositories/types.ts`.
  **Acceptance Criteria**: Render helper supports loading, empty, error, and success states.
  **QA Scenarios**: Happy path: Vitest renders sample page shell with property context, evidence `.omo/evidence/task-5-render-helper.txt`. Failure path: mocked repo rejection shows error state assertion, evidence `.omo/evidence/task-5-error-state.txt`.
  **Commit**: YES - `test(frontend): add page render harness`

- [ ] 6. Shared page layout and state primitives

  **What to do**: Define reusable non-UI-primitive page shells, KPI card patterns, empty/error/loading state helpers, and property filter composition for new pages.
  **Must NOT do**: Do not put hospitality business logic in `src/components/ui`; keep orchestration in page/components.
  **Recommended Agent Profile**: Category `visual-engineering`; Skills `frontend-ui-ux`.
  **Parallelization**: Wave 1; Can run in parallel: YES; Blocks 14-27; Blocked by 5.
  **References**: `src/components/dashboard/dashboard-page.tsx`; `src/components/reservations/reservations-page.tsx`; `src/components/rooms/rooms-page.tsx`; `src/index.css`.
  **Acceptance Criteria**: New pages can reuse consistent shell without duplicate layout code; Harbor/Brass visual language preserved.
  **QA Scenarios**: Happy path: Playwright captures shell in loading/empty/success state, evidence `.omo/evidence/task-6-page-shell.png`. Failure path: force data error and assert visible error recovery action, evidence `.omo/evidence/task-6-error-state.png`.
  **Commit**: YES - `feat(ui): add dashboard page shell patterns`

- [ ] 7. Property scope contract

  **What to do**: Add shared property-scope hook/utility used by all new pages and Tax-Export. Define selected/all-visible properties behavior.
  **Must NOT do**: Do not hardcode single-property assumptions.
  **Recommended Agent Profile**: Category `unspecified-high`; Skills `none`.
  **Parallelization**: Wave 1; Can run in parallel: YES; Blocks 8-45; Blocked by 2,5.
  **References**: `src/hooks/use-page-data.ts`; `src/lib/repositories/types.ts`; `backend/src/index.ts` property query patterns.
  **Acceptance Criteria**: Tests prove two-property scoping and all-properties selection; pages can consume same scope contract.
  **QA Scenarios**: Happy path: Vitest selected property filters sample reservations to one property, evidence `.omo/evidence/task-7-property-scope.txt`. Failure path: unknown property ID returns empty/error-safe state, evidence `.omo/evidence/task-7-bad-property.txt`.
  **Commit**: YES - `feat(scope): add property scoping contract`

- [ ] 8. Lean Prisma foundation migration

  **What to do**: Add shared foundational models only: page-specific operational tables as needed scaffolded minimally, `tax_export_settings`, `tax_export_jobs`, `tax_export_items`, and audit fields. Generate Azure-safe migration.
  **Must NOT do**: Do not add full accounting ledger, full PMS folio engine, or broad payment provider schema upfront.
  **Recommended Agent Profile**: Category `deep`; Skills `none`.
  **Parallelization**: Wave 2; Can run in parallel: NO; Blocks 9-45; Blocked by 1-4,7.
  **References**: `backend/prisma/schema.prisma`; `backend/prisma/AGENTS.md`; `backend/src/ingest/AGENTS.md`; existing `sync_runs`, `email_import_messages`, `integration_connections` models.
  **Acceptance Criteria**: Migration is additive and Azure-safe; `db:generate`, `db:validate`, `db:verify:migration` pass.
  **QA Scenarios**: Happy path: run Prisma validation commands, evidence `.omo/evidence/task-8-prisma-validate.txt`. Failure path: migration linter rejects Supabase/RLS syntax if introduced, evidence `.omo/evidence/task-8-rls-guard.txt`.
  **Commit**: YES - `feat(schema): add dashboard foundation tables`

- [ ] 9. Repository and REST contract expansion

  **What to do**: Extend backend routes and frontend repository types for new operational entities using Track B REST-only pattern.
  **Must NOT do**: Do not add Supabase adapter or fetch calls inside page components.
  **Recommended Agent Profile**: Category `deep`; Skills `none`.
  **Parallelization**: Wave 2; Can run in parallel: YES; Blocks 14-45; Blocked by 8.
  **References**: `src/lib/repositories/types.ts`; `src/lib/repositories/rest-repositories.ts`; `src/lib/repositories/AGENTS.md`; `backend/src/index.ts`.
  **Acceptance Criteria**: Each new repository method has typed response contract and backend test.
  **QA Scenarios**: Happy path: curl each new list endpoint returns JSON array with property scope, evidence `.omo/evidence/task-9-rest-contracts.txt`. Failure path: invalid property ID returns controlled 400/empty behavior per contract, evidence `.omo/evidence/task-9-invalid-property.txt`.
  **Commit**: YES - `feat(api): add dashboard repository contracts`

- [ ] 10. WithOne ProviderConnector interface

  **What to do**: Add minimal connector port/interface around WithOne actions: list connections, Gmail search/get, Sheets read/write, connection health. Use existing client under the hood.
  **Must NOT do**: Do not build generic workflow engine or live OTA APIs.
  **Recommended Agent Profile**: Category `deep`; Skills `none`.
  **Parallelization**: Wave 2; Can run in parallel: YES; Blocks 28-34,41-45; Blocked by 4.
  **References**: `backend/src/integrations/one/client.ts`; `backend/src/integrations/one/connections.ts`; `backend/src/integrations/one/google/gmail.ts`; `backend/src/integrations/one/google/sheets.ts`; `backend/src/routes/one.ts`.
  **Acceptance Criteria**: Interface can be mocked in tests; existing WithOne route behavior unchanged.
  **QA Scenarios**: Happy path: backend unit test uses mock connector for Gmail+Sheets, evidence `.omo/evidence/task-10-connector-mock.txt`. Failure path: revoked connection maps to actionable disconnected status, evidence `.omo/evidence/task-10-disconnected.txt`.
  **Commit**: YES - `feat(integrations): add WithOne connector port`

- [ ] 11. Source account generalization

  **What to do**: Replace hardcoded Airbnb-only assumptions with dynamic provider/account lookup backed by `external_accounts` and `channels`, preserving current Airbnb seed behavior.
  **Must NOT do**: Do not break existing Airbnb ingestion.
  **Recommended Agent Profile**: Category `unspecified-high`; Skills `none`.
  **Parallelization**: Wave 2; Can run in parallel: YES; Blocks 28-34, Channel Distribution; Blocked by 8-10.
  **References**: `backend/src/ingest/contracts.ts`; `backend/src/ingest/services/listings.ts`; `backend/src/ingest/services/reservations.ts`; `backend/prisma/schema.prisma`.
  **Acceptance Criteria**: Airbnb accounts still work; tests add Booking.com/Agoda account keys without code changes.
  **QA Scenarios**: Happy path: backend test resolves Airbnb, Booking.com, Agoda account fixtures, evidence `.omo/evidence/task-11-source-accounts.txt`. Failure path: unknown account returns validation error, evidence `.omo/evidence/task-11-unknown-account.txt`.
  **Commit**: YES - `feat(ingest): generalize provider accounts`

- [ ] 12. Page data hooks for 11 new pages

  **What to do**: Add hook skeletons with typed data contracts for Check-in/out, VIP Guests, Room Types, Availability, Housekeeping, Dining & Events, Rate Manager, Billing & Invoices, Channel Distribution, Staff & Roles, Security & Access.
  **Must NOT do**: Do not over-fetch all dashboard data in each hook.
  **Recommended Agent Profile**: Category `unspecified-high`; Skills `none`.
  **Parallelization**: Wave 2; Can run in parallel: YES; Blocks 14-27; Blocked by 7-9.
  **References**: `src/hooks/use-page-data.ts`; `src/hooks/use-dashboard-data.ts`; `src/lib/repositories/types.ts`.
  **Acceptance Criteria**: Each hook has loading/error/success tests with property scope.
  **QA Scenarios**: Happy path: Vitest validates each hook returns scoped fixtures, evidence `.omo/evidence/task-12-hooks.txt`. Failure path: repo error propagates safe page error state, evidence `.omo/evidence/task-12-hook-errors.txt`.
  **Commit**: YES - `feat(hooks): add dashboard page data hooks`

- [ ] 13. Router wiring for 11 new pages

  **What to do**: Add lazy routes and sidebar links for every missing page with production page modules ready to receive implementations.
  **Must NOT do**: Do not create placeholder-only pages; route files must be connected to real implementation tasks.
  **Recommended Agent Profile**: Category `quick`; Skills `none`.
  **Parallelization**: Wave 2; Can run in parallel: YES; Blocks 14-27 final route QA; Blocked by 3.
  **References**: `src/router.tsx`; `src/components/app-sidebar.tsx`.
  **Acceptance Criteria**: Route contract test lists 11/11; sidebar navigation uses links to new routes.
  **QA Scenarios**: Happy path: Playwright clicks each sidebar item and sees correct page title, evidence `.omo/evidence/task-13-sidebar-routes.txt`. Failure path: navigating bad route shows router-safe not found/error behavior, evidence `.omo/evidence/task-13-bad-route.txt`.
  **Commit**: YES - `feat(routes): add missing dashboard routes`

- [ ] 14. Check-in / Check-out page

  **What to do**: Implement today's arrivals/departures board with check-in, check-out, late checkout, room assignment status, and property filter.
  **Must NOT do**: Do not mutate reservation semantics outside existing reservation source of truth.
  **Recommended Agent Profile**: Category `visual-engineering`; Skills `frontend-ui-ux`.
  **Parallelization**: Wave 3; Can run in parallel: YES; Blocks 41 final integration; Blocked by 12-13.
  **References**: `src/components/reservations/reservations-page.tsx`; `src/hooks/use-page-data.ts`; `backend/src/index.ts` reservation endpoints.
  **Acceptance Criteria**: Shows arrivals/departures for selected property and date; actions update status through REST contract; tests cover happy and invalid transition.
  **QA Scenarios**: Happy path: Playwright select property, check in reservation, status changes to in-house, evidence `.omo/evidence/task-14-checkin.png`. Failure path: check-out missing room assignment shows controlled error, evidence `.omo/evidence/task-14-checkout-error.png`.
  **Commit**: YES - `feat(front-office): add check-in checkout page`

- [ ] 15. VIP Guests page

  **What to do**: Implement VIP guest list, reservation history, property filter, notes/flags, and quick navigation to reservation details.
  **Must NOT do**: Do not treat `guests` table as booking source of truth; derive from reservations where current app does.
  **Recommended Agent Profile**: Category `quick`; Skills `none`.
  **Parallelization**: Wave 3; Can run in parallel: YES; Blocks none except final; Blocked by 12-13.
  **References**: `src/components/guests/guests-page.tsx`; `src/hooks/use-page-data.ts`; `src/hooks/use-dashboard-data.ts` `toDashboardGuest` mapping.
  **Acceptance Criteria**: VIP-only filter works; empty state works; two-property test prevents cross-property leakage.
  **QA Scenarios**: Happy path: Playwright open VIP Guests and confirm only VIP rows, evidence `.omo/evidence/task-15-vip-guests.png`. Failure path: no VIP fixtures shows empty state with explanation, evidence `.omo/evidence/task-15-empty.png`.
  **Commit**: YES - `feat(guests): add vip guests page`

- [ ] 16. Room Types page

  **What to do**: Implement room type management page and wire Rooms page Manage Room Types button to it.
  **Must NOT do**: Do not alter room inventory outside explicit room type actions.
  **Recommended Agent Profile**: Category `visual-engineering`; Skills `frontend-ui-ux`.
  **Parallelization**: Wave 3; Can run in parallel: YES; Blocks 17, 21; Blocked by 8-13.
  **References**: `src/components/rooms/rooms-page.tsx`; `backend/prisma/schema.prisma`; `src/types/database.ts`.
  **Acceptance Criteria**: Room types can list/create/edit/deactivate per property; Rooms button navigates correctly.
  **QA Scenarios**: Happy path: Playwright create room type `Deluxe King`, see in list, evidence `.omo/evidence/task-16-room-type.png`. Failure path: duplicate room type name in same property rejected, evidence `.omo/evidence/task-16-duplicate.png`.
  **Commit**: YES - `feat(rooms): add room types page`

- [ ] 17. Availability page

  **What to do**: Implement date-grid availability view by property, room type, physical room, reservation allocation, and out-of-order status.
  **Must NOT do**: Do not invent channel-manager push logic here.
  **Recommended Agent Profile**: Category `visual-engineering`; Skills `frontend-ui-ux`.
  **Parallelization**: Wave 3; Can run in parallel: YES; Blocks Rate Manager and Channel Distribution display alignment; Blocked by 14,16.
  **References**: `src/components/rooms/rooms-page.tsx`; `backend/prisma/schema.prisma` `reservations`, `reservation_room_allocations`; `src/hooks/use-page-data.ts`.
  **Acceptance Criteria**: Grid renders at least 30 days; occupied/vacant/out-of-order states accurate; property filter works.
  **QA Scenarios**: Happy path: Playwright verify occupied cell for fixture reservation date, evidence `.omo/evidence/task-17-availability.png`. Failure path: overlapping reservation fixtures surface conflict marker, evidence `.omo/evidence/task-17-conflict.png`.
  **Commit**: YES - `feat(rooms): add availability grid`

- [ ] 18. Housekeeping page

  **What to do**: Implement housekeeping board with room cleanliness states, assignment, priority, checkout-today cues, and property scope.
  **Must NOT do**: Do not conflate maintenance issues with housekeeping tasks; link but keep separate states.
  **Recommended Agent Profile**: Category `visual-engineering`; Skills `frontend-ui-ux`.
  **Parallelization**: Wave 3; Can run in parallel: YES; Blocks Check-in operational polish; Blocked by 8-13.
  **References**: `src/components/rooms/rooms-page.tsx`; `src/components/maintenance/maintenance-page.tsx`; `backend/prisma/schema.prisma` rooms/maintenance.
  **Acceptance Criteria**: Dirty/clean/inspected/out-of-order states visible and updateable; checkout-today rooms highlighted.
  **QA Scenarios**: Happy path: Playwright mark dirty room as inspected, evidence `.omo/evidence/task-18-housekeeping.png`. Failure path: out-of-order room cannot be marked ready without resolving blocker, evidence `.omo/evidence/task-18-out-of-order.png`.
  **Commit**: YES - `feat(property): add housekeeping board`

- [ ] 19. Dining & Events page

  **What to do**: Implement lean dining/events operations page: event bookings, venue/area schedule, guest/reservation association, property filter.
  **Must NOT do**: Do not build full POS or catering inventory system.
  **Recommended Agent Profile**: Category `visual-engineering`; Skills `frontend-ui-ux`.
  **Parallelization**: Wave 3; Can run in parallel: YES; Blocks none except final; Blocked by 8-13.
  **References**: `src/components/dashboard/dashboard-page.tsx` layout pattern; `backend/prisma/schema.prisma` property/reservation relationships.
  **Acceptance Criteria**: Can list/create/update/cancel event bookings; links to reservation if present; tests cover property scoping.
  **QA Scenarios**: Happy path: Playwright create event `Private Dinner` for property A, evidence `.omo/evidence/task-19-event.png`. Failure path: end time before start time rejected, evidence `.omo/evidence/task-19-invalid-time.png`.
  **Commit**: YES - `feat(property): add dining events page`

- [ ] 20. Maintenance Log Issue action

  **What to do**: Wire existing Maintenance page Log Issue button to create issue flow with validation, property/room selection, severity, and optimistic update.
  **Must NOT do**: Do not redesign the entire maintenance page.
  **Recommended Agent Profile**: Category `quick`; Skills `none`.
  **Parallelization**: Wave 3; Can run in parallel: YES; Blocks none except final; Blocked by 9,12.
  **References**: `src/components/maintenance/maintenance-page.tsx`; `src/hooks/use-page-data.ts`; `backend/src/index.ts` maintenance endpoints.
  **Acceptance Criteria**: Button creates issue through REST endpoint; error state visible; tests cover required fields.
  **QA Scenarios**: Happy path: Playwright click Log Issue, submit `AC leak`, row appears, evidence `.omo/evidence/task-20-log-issue.png`. Failure path: submit without room/severity shows validation errors, evidence `.omo/evidence/task-20-validation.png`.
  **Commit**: YES - `feat(maintenance): wire log issue action`

- [ ] 21. Rate Manager page

  **What to do**: Implement rate calendar by property/room type/date with base rate, overrides, minimum stay, closed-to-arrival flag, and future WithOne export-ready shape.
  **Must NOT do**: Do not push rates to OTAs live.
  **Recommended Agent Profile**: Category `deep`; Skills `none`.
  **Parallelization**: Wave 4; Can run in parallel: YES; Blocks Channel Distribution read alignment; Blocked by 16-17.
  **References**: `src/components/dashboard/revenue-overview.tsx` revenue-source gap; `backend/prisma/schema.prisma`; `src/components/rooms/rooms-page.tsx`.
  **Acceptance Criteria**: Rates CRUD per property/room type/date; conflict validation; no live provider push.
  **QA Scenarios**: Happy path: Playwright set rate `1500000 VND` for Deluxe King on date, evidence `.omo/evidence/task-21-rate.png`. Failure path: negative rate rejected, evidence `.omo/evidence/task-21-negative-rate.png`.
  **Commit**: YES - `feat(revenue): add rate manager`

- [ ] 22. Billing & Invoices page

  **What to do**: Implement lean operational folio/invoice page for reservation charge/payment notes, invoice-like status tracking, export visibility, and property filter.
  **Must NOT do**: Do not build payment processor integration or full accounting ledger.
  **Recommended Agent Profile**: Category `deep`; Skills `none`.
  **Parallelization**: Wave 4; Can run in parallel: YES; Blocks Tax-Export display enrichment; Blocked by 8-13.
  **References**: `backend/prisma/schema.prisma` reservations/external refs; `src/components/reservations/reservations-page.tsx`; Tax-Export sheet columns in this plan.
  **Acceptance Criteria**: Can list folio-like records, add non-ledger charge/payment notes, mark record exported/paid for operations only; tests cover property scope.
  **QA Scenarios**: Happy path: Playwright add operational charge note to reservation record, evidence `.omo/evidence/task-22-invoice.png`. Failure path: invalid negative amount note is rejected, evidence `.omo/evidence/task-22-invalid-amount.png`.
  **Commit**: YES - `feat(revenue): add billing invoices page`

- [ ] 23. Channel Distribution page

  **What to do**: Implement channel/listing/account mapping page using existing provider-edge tables and WithOne connection status.
  **Must NOT do**: Do not implement live OTA sync/push.
  **Recommended Agent Profile**: Category `unspecified-high`; Skills `none`.
  **Parallelization**: Wave 4; Can run in parallel: YES; Blocks 41 integration hardening; Blocked by 10-11,17,21.
  **References**: `backend/prisma/schema.prisma` channels/external_accounts/channel_listings/listing_room_mappings; `src/pages/settings/integrations-page.tsx`; `backend/src/routes/one.ts`.
  **Acceptance Criteria**: Shows channels, external accounts, mapped listings, unmapped listings, and connection health; no live provider mutation.
  **QA Scenarios**: Happy path: Playwright map provider listing to room, evidence `.omo/evidence/task-23-channel-map.png`. Failure path: disconnected WithOne shows setup prompt, evidence `.omo/evidence/task-23-disconnected.png`.
  **Commit**: YES - `feat(revenue): add channel distribution page`

- [ ] 24. Staff & Roles page

  **What to do**: Implement lean staff directory, role assignment, property assignment, and page/action permissions model needed by Tax-Export and operations pages.
  **Must NOT do**: Do not integrate external auth provider unless already present.
  **Recommended Agent Profile**: Category `deep`; Skills `none`.
  **Parallelization**: Wave 4; Can run in parallel: YES; Blocks Security page and Tax-Export permissions; Blocked by 8-13.
  **References**: `src/router.tsx`; `backend/src/index.ts`; AGENTS Auth deferred note in README.
  **Acceptance Criteria**: Roles include admin/manager/accountant/staff; permissions gate export/settings actions in UI and backend tests.
  **QA Scenarios**: Happy path: Playwright manager can view operations but accountant can run Tax-Export, evidence `.omo/evidence/task-24-roles.png`. Failure path: staff user cannot edit sheet settings, evidence `.omo/evidence/task-24-permission-denied.png`.
  **Commit**: YES - `feat(admin): add staff roles page`

- [ ] 25. Security & Access page

  **What to do**: Implement audit/security page for integration connections, export jobs, webhook events, access changes, and API status.
  **Must NOT do**: Do not expose secrets, tokens, raw email bodies, or full PII in logs.
  **Recommended Agent Profile**: Category `unspecified-high`; Skills `none`.
  **Parallelization**: Wave 4; Can run in parallel: YES; Blocks final security verification; Blocked by 10,24.
  **References**: `backend/src/routes/one.ts`; `backend/src/integrations/one/webhooks.ts`; `backend/prisma/schema.prisma` sync_runs/integration_connections.
  **Acceptance Criteria**: Audit log visible with redacted data; webhook statuses visible; role gates enforced.
  **QA Scenarios**: Happy path: Playwright view audit row for export job without secrets, evidence `.omo/evidence/task-25-audit.png`. Failure path: secret-like value never appears in DOM/log fixture, evidence `.omo/evidence/task-25-secret-redaction.txt`.
  **Commit**: YES - `feat(admin): add security access page`

- [ ] 26. Guests Export button

  **What to do**: Wire Guests page Export button to scoped CSV export of visible guest/reservation-derived rows.
  **Must NOT do**: Do not confuse this with Tax-Export or write to Google Sheets.
  **Recommended Agent Profile**: Category `quick`; Skills `none`.
  **Parallelization**: Wave 4; Can run in parallel: YES; Blocks none; Blocked by 9,12.
  **References**: `src/components/guests/guests-page.tsx`; `src/hooks/use-page-data.ts`; `src/types/database.ts`.
  **Acceptance Criteria**: CSV includes only visible/scoped rows and expected headers; empty export handled.
  **QA Scenarios**: Happy path: Playwright click Export, downloaded CSV contains `guest_name`, evidence `.omo/evidence/task-26-guests-export.csv`. Failure path: no visible guests shows disabled/actionable empty export state, evidence `.omo/evidence/task-26-empty-export.png`.
  **Commit**: YES - `feat(guests): wire guest csv export`

- [ ] 27. Page integration polish pass

  **What to do**: Ensure all 11 pages share consistent navigation, breadcrumbs/title, property filters, responsive behavior, loading/empty/error states, and no placeholder copy.
  **Must NOT do**: Do not add new features beyond page polish and consistency.
  **Recommended Agent Profile**: Category `visual-engineering`; Skills `frontend-ui-ux`.
  **Parallelization**: Wave 4; Can run in parallel: NO; Blocks final verification; Blocked by 14-26.
  **References**: all new page files; `src/components/app-sidebar.tsx`; `src/index.css`; existing dashboard pages.
  **Acceptance Criteria**: Playwright visits every route at desktop and mobile widths; no placeholder text; all states captured.
  **QA Scenarios**: Happy path: Playwright route sweep screenshots all 11 pages, evidence `.omo/evidence/task-27-route-sweep/`. Failure path: forced repo errors on all pages show recoverable error state, evidence `.omo/evidence/task-27-error-sweep/`.
  **Commit**: YES - `fix(ui): polish dashboard page suite`

- [ ] 28. Tax-Export backend contracts and schema

  **What to do**: Finalize `tax_export_settings`, `tax_export_jobs`, `tax_export_items` fields and backend DTOs. Include statuses: pending, exported, skipped, failed, needs_review.
  **Must NOT do**: Do not store secrets or full raw email body.
  **Recommended Agent Profile**: Category `deep`; Skills `none`.
  **Parallelization**: Wave 5; Can run in parallel: NO; Blocks 29-40; Blocked by 8-10,24.
  **References**: `backend/prisma/schema.prisma`; `backend/src/ingest/contracts.ts`; `backend/src/ingest/pipeline.ts`; `backend/src/routes/one.ts`.
  **Acceptance Criteria**: Backend tests cover config creation, job creation, item state transitions, permission checks.
  **QA Scenarios**: Happy path: curl create export job for today returns items for checkout-today reservations, evidence `.omo/evidence/task-28-job-create.json`. Failure path: user without permission receives 403, evidence `.omo/evidence/task-28-forbidden.json`.
  **Commit**: YES - `feat(tax): add export job contracts`

- [ ] 29. Gmail search service for confirmation codes

  **What to do**: Implement backend service that searches Gmail through WithOne by confirmation code, with fallback guest/date search, timeout, quota handling, and no frontend exposure.
  **Must NOT do**: Do not use direct Gmail API from frontend; do not persist full email body.
  **Recommended Agent Profile**: Category `deep`; Skills `none`.
  **Parallelization**: Wave 5; Can run in parallel: YES; Blocks 30-34; Blocked by 10,28.
  **References**: `backend/src/integrations/one/google/gmail.ts`; `backend/src/ingest/services/email.ts`; `backend/src/integrations/one/client.ts`.
  **Acceptance Criteria**: Tests cover exact code match, no match, multiple matches, quota error, revoked connection.
  **QA Scenarios**: Happy path: Node test mock Gmail returns one email for code `ABC123`, evidence `.omo/evidence/task-29-gmail-search.txt`. Failure path: multiple emails return `needs_review`, evidence `.omo/evidence/task-29-multiple-match.txt`.
  **Commit**: YES - `feat(tax): add gmail confirmation search`

- [ ] 30. OTA parser registry and fixtures

  **What to do**: Implement parser registry for Airbnb, Booking.com, Agoda, and generic fallback. Extract platform, gross amount, tax amount if present, fees, payout, currency, email date, confidence.
  **Must NOT do**: Do not hard-fail unknown email formats; return `needs_review` with reason.
  **Recommended Agent Profile**: Category `ultrabrain`; Skills `none`.
  **Parallelization**: Wave 5; Can run in parallel: YES; Blocks 31-34; Blocked by 2,4,28-29.
  **References**: `backend/src/ingest/normalizer.ts`; `backend/src/ingest/services/reservations.ts`; sample fixtures created in task 2.
  **Acceptance Criteria**: Parser fixture tests pass for Airbnb, Booking.com, Agoda, generic, forwarded email, cancellation/modification, missing tax line, multi-currency.
  **QA Scenarios**: Happy path: Node parser test extracts `gross_amount` and `payout_amount` from Airbnb fixture, evidence `.omo/evidence/task-30-airbnb-parser.txt`. Failure path: malformed total marks low confidence needs_review, evidence `.omo/evidence/task-30-malformed.txt`.
  **Commit**: YES - `feat(tax): add ota email parser registry`

- [ ] 31. Google Sheets writer/upsert service

  **What to do**: Add WithOne-backed Sheets write path with stable column mapping, row lookup by idempotency key, batchUpdate upsert, and dry-run preview.
  **Must NOT do**: Do not blind append duplicate rows; do not require service account if WithOne connection is selected path.
  **Recommended Agent Profile**: Category `deep`; Skills `none`.
  **Parallelization**: Wave 5; Can run in parallel: YES; Blocks 33-40; Blocked by 10,28.
  **References**: `backend/src/integrations/one/google/sheets.ts`; `backend/src/ingest/services/sheets-one.ts`; `backend/src/ingest/services/sheets.ts`.
  **Acceptance Criteria**: Tests prove upsert update on repeated idempotency key; dry-run returns row payload without writing.
  **QA Scenarios**: Happy path: mocked Sheets receives batchUpdate with expected columns, evidence `.omo/evidence/task-31-sheet-write.json`. Failure path: duplicate rerun updates row index not append, evidence `.omo/evidence/task-31-idempotent.json`.
  **Commit**: YES - `feat(tax): add sheets upsert writer`

- [ ] 32. Tax-Export orchestration service

  **What to do**: Build job runner: select checkout-today reservations, search email, parse, confidence score, write/preview sheet row, persist item result.
  **Must NOT do**: Do not let one item failure fail entire batch.
  **Recommended Agent Profile**: Category `deep`; Skills `none`.
  **Parallelization**: Wave 5; Can run in parallel: NO; Blocks 33-40; Blocked by 28-31.
  **References**: `backend/src/ingest/pipeline.ts`; `backend/src/ingest/services/email.ts`; `backend/src/ingest/services/reservations.ts`; `backend/src/index.ts` route style.
  **Acceptance Criteria**: Backend tests cover exported/skipped/failed/needs_review; two-property checkout-today selection; timezone fallback.
  **QA Scenarios**: Happy path: run job for `2026-05-29`, only checkouts on that date exported, evidence `.omo/evidence/task-32-same-day.json`. Failure path: Gmail timeout marks affected item failed/retryable while other item exports, evidence `.omo/evidence/task-32-partial-failure.json`.
  **Commit**: YES - `feat(tax): add export orchestration`

- [ ] 33. Tax-Export REST endpoints

  **What to do**: Add endpoints for settings, preview, run, job history, item retry, item mark reviewed, and per-reservation export.
  **Must NOT do**: Do not expose raw email body or WithOne secrets.
  **Recommended Agent Profile**: Category `unspecified-high`; Skills `none`.
  **Parallelization**: Wave 5; Can run in parallel: YES after 32; Blocks 35-40; Blocked by 32.
  **References**: `backend/src/index.ts`; `backend/src/ingest/routes.ts`; `backend/src/routes/one.ts`.
  **Acceptance Criteria**: Every endpoint has Node tests for success, permission failure, validation failure.
  **QA Scenarios**: Happy path: curl preview then run then history returns expected job, evidence `.omo/evidence/task-33-tax-api.json`. Failure path: missing sheet ID returns 400 with actionable error, evidence `.omo/evidence/task-33-missing-sheet.json`.
  **Commit**: YES - `feat(tax): add export api routes`

- [ ] 34. Tax-Export observability and privacy checks

  **What to do**: Add structured redacted audit entries, metrics counters, error reasons, and parser confidence reporting.
  **Must NOT do**: Do not log secrets, OAuth tokens, full email body, or unnecessary PII.
  **Recommended Agent Profile**: Category `unspecified-high`; Skills `none`.
  **Parallelization**: Wave 5; Can run in parallel: YES; Blocks Security page final data; Blocked by 28-33.
  **References**: `backend/src/integrations/one/webhooks.ts`; `backend/src/ingest/pipeline.ts`; `backend/prisma/schema.prisma` sync_runs/sync_dead_letters.
  **Acceptance Criteria**: Tests assert redaction; job history includes parse success %, failure reasons, duplicate count.
  **QA Scenarios**: Happy path: job audit shows counts and redacted source ID, evidence `.omo/evidence/task-34-audit.json`. Failure path: fixture containing token string never appears in logs, evidence `.omo/evidence/task-34-redaction.txt`.
  **Commit**: YES - `feat(tax): add export observability`

- [ ] 35. Tax & Compliance page

  **What to do**: Implement dedicated page with today's checkout export card, sheet settings, preview table, run history, needs_review queue, retry actions, and property scope.
  **Must NOT do**: Do not present accountant-specific tax law formulas as authoritative calculations.
  **Recommended Agent Profile**: Category `visual-engineering`; Skills `frontend-ui-ux`.
  **Parallelization**: Wave 6; Can run in parallel: YES; Blocks 40-45; Blocked by 33-34.
  **References**: `src/pages/settings/integrations-page.tsx`; `src/components/reservations/reservations-page.tsx`; `src/lib/repositories/rest-repositories.ts`.
  **Acceptance Criteria**: Page shows default date today, checkout count, preview, run, history, settings, and needs_review queue.
  **QA Scenarios**: Happy path: Playwright open Tax & Compliance, date defaults today, preview shows checkout reservations, evidence `.omo/evidence/task-35-tax-page.png`. Failure path: disconnected WithOne shows connect prompt and disables run, evidence `.omo/evidence/task-35-disconnected.png`.
  **Commit**: YES - `feat(tax): add tax compliance page`

- [ ] 36. Per-reservation Tax-Export row action

  **What to do**: Add action to Reservations table row to export or preview one reservation by confirmation code.
  **Must NOT do**: Do not bypass Tax-Export job/item audit.
  **Recommended Agent Profile**: Category `visual-engineering`; Skills `frontend-ui-ux`.
  **Parallelization**: Wave 6; Can run in parallel: YES; Blocks final QA; Blocked by 33, existing Reservations page.
  **References**: `src/components/reservations/reservations-page.tsx`; `src/hooks/use-page-data.ts`; `src/lib/repositories/rest-repositories.ts`.
  **Acceptance Criteria**: Action visible per row; successful export updates status; failed parse shows needs_review.
  **QA Scenarios**: Happy path: Playwright row menu export reservation `ABC123`, status exported, evidence `.omo/evidence/task-36-row-export.png`. Failure path: row with no confirmation code shows needs_review/error prompt, evidence `.omo/evidence/task-36-no-code.png`.
  **Commit**: YES - `feat(reservations): add tax export row action`

- [ ] 37. Scheduled Tax-Export UI and backend trigger

  **What to do**: Add schedule configuration for same-day checkout export with manual enable/disable, next-run display, and backend trigger path. Implement schedule architecture safely; actual cron can be app-level or documented if runtime lacks scheduler.
  **Must NOT do**: Do not create retry storms or silent background failures.
  **Recommended Agent Profile**: Category `deep`; Skills `none`.
  **Parallelization**: Wave 6; Can run in parallel: YES; Blocks 42; Blocked by 32-35.
  **References**: `backend/src/ingest/pipeline.ts`; `backend/src/ingest/watchers/folder.ts`; `src/pages/settings/integrations-page.tsx`.
  **Acceptance Criteria**: Schedule can be enabled/disabled; next run shown; manual trigger path reuses same orchestration; tests cover disabled and failure states.
  **QA Scenarios**: Happy path: Playwright enable schedule at `18:00 Asia/Ho_Chi_Minh`, evidence `.omo/evidence/task-37-schedule.png`. Failure path: schedule disabled prevents job start and records no job, evidence `.omo/evidence/task-37-disabled.txt`.
  **Commit**: YES - `feat(tax): add scheduled export controls`

- [ ] 38. Sheet settings and column mapping UI

  **What to do**: Add settings UI for sheet ID/URL, worksheet/tab, column mapping, parser threshold, and test connection.
  **Must NOT do**: Do not store Google credentials; only store sheet IDs, connection keys, and mapping config.
  **Recommended Agent Profile**: Category `visual-engineering`; Skills `frontend-ui-ux`.
  **Parallelization**: Wave 6; Can run in parallel: YES; Blocks final Tax QA; Blocked by 31,33,35.
  **References**: `src/pages/settings/integrations-page.tsx`; `backend/src/routes/one.ts`; `backend/src/integrations/one/connections.ts`.
  **Acceptance Criteria**: User can save sheet URL/ID, test access, and see validation errors for bad URL or missing tab.
  **QA Scenarios**: Happy path: Playwright save sheet URL `https://docs.google.com/spreadsheets/d/test-sheet/edit`, evidence `.omo/evidence/task-38-settings.png`. Failure path: invalid URL rejected with exact message, evidence `.omo/evidence/task-38-invalid-url.png`.
  **Commit**: YES - `feat(tax): add sheet settings ui`

- [ ] 39. Needs-review correction workflow

  **What to do**: Add UI/API flow to inspect item reason, edit parsed fields, approve row, retry Gmail search, or skip item.
  **Must NOT do**: Do not require manual DB edits for corrections.
  **Recommended Agent Profile**: Category `visual-engineering`; Skills `frontend-ui-ux`.
  **Parallelization**: Wave 6; Can run in parallel: YES; Blocks final Tax QA; Blocked by 32-35.
  **References**: Tax item statuses from task 28; `src/pages/settings/integrations-page.tsx` action patterns.
  **Acceptance Criteria**: needs_review item can become exported/skipped/failed after explicit action; audit records correction.
  **QA Scenarios**: Happy path: Playwright edit payout amount and approve item, evidence `.omo/evidence/task-39-review-approve.png`. Failure path: invalid amount blocks approval, evidence `.omo/evidence/task-39-invalid-amount.png`.
  **Commit**: YES - `feat(tax): add review correction workflow`

- [ ] 40. Tax-Export end-to-end UI polish

  **What to do**: Polish Tax page, row action, statuses, toasts, empty states, loading states, disconnected states, and same-day default messaging.
  **Must NOT do**: Do not add new tax categories beyond sheet-driven fields.
  **Recommended Agent Profile**: Category `visual-engineering`; Skills `frontend-ui-ux`.
  **Parallelization**: Wave 6; Can run in parallel: NO; Blocks final verification; Blocked by 35-39.
  **References**: `src/components/dashboard/dashboard-page.tsx`; `src/components/reservations/reservations-page.tsx`; `src/index.css`.
  **Acceptance Criteria**: UX clearly communicates today's checkout rule and idempotent upsert behavior; all states have evidence screenshots.
  **QA Scenarios**: Happy path: Playwright full preview-run-history flow, evidence `.omo/evidence/task-40-tax-e2e.png`. Failure path: low confidence parser routes to review queue, evidence `.omo/evidence/task-40-low-confidence.png`.
  **Commit**: YES - `fix(tax): polish export workflow ui`

- [ ] 41. Integration dashboard hardening

  **What to do**: Update Integrations page to reflect ProviderConnector status, Gmail/Sheets readiness, Tax-Export dependencies, and future provider slots.
  **Must NOT do**: Do not add live provider onboarding beyond existing WithOne connection flow.
  **Recommended Agent Profile**: Category `unspecified-high`; Skills `none`.
  **Parallelization**: Wave 7; Can run in parallel: YES; Blocks final verification; Blocked by 10,23,35.
  **References**: `src/pages/settings/integrations-page.tsx`; `src/hooks/use-pipeline-status.ts`; `src/hooks/use-one-connections.ts`; `backend/src/ingest/pipeline.ts`.
  **Acceptance Criteria**: Integrations page shows Gmail/Sheets readiness for Tax-Export and future connector states.
  **QA Scenarios**: Happy path: Playwright sees Gmail connected and Sheets ready, evidence `.omo/evidence/task-41-integrations-ready.png`. Failure path: missing Sheets config shows setup callout, evidence `.omo/evidence/task-41-sheets-missing.png`.
  **Commit**: YES - `feat(integrations): show connector readiness`

- [ ] 42. Scheduler and retry safety hardening

  **What to do**: Add retry/backoff, job locking, duplicate-run protection, item-level retry, and dead-letter state for Tax-Export scheduled/manual jobs.
  **Must NOT do**: Do not allow concurrent same-date same-scope jobs to duplicate sheet rows.
  **Recommended Agent Profile**: Category `deep`; Skills `none`.
  **Parallelization**: Wave 7; Can run in parallel: YES; Blocks final Tax approval; Blocked by 32,37.
  **References**: `backend/src/ingest/pipeline.ts`; `backend/src/ingest/services/email.ts`; `backend/prisma/schema.prisma` sync_runs/sync_dead_letters.
  **Acceptance Criteria**: Concurrent job test produces one active/exported result; retryable failures can rerun item only.
  **QA Scenarios**: Happy path: backend test launches duplicate jobs and second is rejected/coalesced, evidence `.omo/evidence/task-42-locking.txt`. Failure path: quota error backs off and marks retryable, evidence `.omo/evidence/task-42-backoff.txt`.
  **Commit**: YES - `fix(tax): harden scheduler retries`

- [ ] 43. Performance and pagination pass

  **What to do**: Add pagination/windowing/server filters where needed for large reservations, exports, audit logs, availability grids, and sheet history.
  **Must NOT do**: Do not fetch all historical data into every page.
  **Recommended Agent Profile**: Category `unspecified-high`; Skills `performance-profiling`.
  **Parallelization**: Wave 7; Can run in parallel: YES; Blocks final performance QA; Blocked by 14-40.
  **References**: `src/lib/repositories/rest-repositories.ts`; `backend/src/index.ts`; page hooks from task 12.
  **Acceptance Criteria**: Pages remain responsive with fixture volume; backend endpoints accept limit/date/property filters where needed.
  **QA Scenarios**: Happy path: Playwright load 500 reservation fixtures under 3s local dev, evidence `.omo/evidence/task-43-performance.txt`. Failure path: requesting huge page size clamps to max, evidence `.omo/evidence/task-43-page-size.txt`.
  **Commit**: YES - `perf(dashboard): add pagination filters`

- [ ] 44. Accessibility and responsive QA pass

  **What to do**: Check all new pages and Tax-Export flows for keyboard navigation, labels, focus states, contrast, and mobile layout.
  **Must NOT do**: Do not redesign visual system outside accessibility fixes.
  **Recommended Agent Profile**: Category `visual-engineering`; Skills `frontend-ui-ux`.
  **Parallelization**: Wave 7; Can run in parallel: YES; Blocks final QA; Blocked by 27,40.
  **References**: all new page components; `src/components/ui/AGENTS.md`; `src/index.css`.
  **Acceptance Criteria**: Keyboard can reach all core actions; forms have labels/errors; mobile screenshots acceptable.
  **QA Scenarios**: Happy path: Playwright keyboard navigates Tax-Export run flow, evidence `.omo/evidence/task-44-keyboard.png`. Failure path: required form fields announce errors, evidence `.omo/evidence/task-44-form-errors.png`.
  **Commit**: YES - `fix(a11y): improve dashboard accessibility`

- [ ] 45. Full-system verification docs and evidence index

  **What to do**: Create markdown evidence index in `.omo/` summarizing all verification commands, evidence files, known limitations, and future hooks for per-user/per-tenant settings.
  **Must NOT do**: Do not write runtime docs outside `.omo/` as part of this plan.
  **Recommended Agent Profile**: Category `writing`; Skills `none`.
  **Parallelization**: Wave 7; Can run in parallel: NO; Blocks F1-F4; Blocked by 1-44.
  **References**: `.omo/evidence/`; this plan; final command outputs.
  **Acceptance Criteria**: `.omo/evidence/dashboard-completion-index.md` lists every task evidence path and command result.
  **QA Scenarios**: Happy path: Bash confirms evidence index contains tasks 1-45 and F1-F4 entries, evidence `.omo/evidence/task-45-index-check.txt`. Failure path: missing evidence path check fails with task number, evidence `.omo/evidence/task-45-missing-evidence.txt`.
  **Commit**: YES - `docs(omo): add verification evidence index`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read this plan end-to-end. Verify every Must Have exists and every Must NOT Have is absent. Check `.omo/evidence/` files exist for all tasks. Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`.

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run frontend/backend build, typecheck, tests, lint-equivalent checks. Review changed files for AI slop, unused code, unsafe `any`, frontend direct Gmail/Sheets calls, raw email persistence. Output: `Build [PASS/FAIL] | Tests [N/N] | Files [N clean/N issues] | VERDICT`.

- [ ] F3. **Real Manual QA** — `unspecified-high` + `playwright`
  Execute every task QA scenario from clean state. Cover two properties, same-day checkout export, parser success/failure, disconnected WithOne, duplicate export rerun. Save evidence to `.omo/evidence/final-qa/`. Output: `Scenarios [N/N pass] | Integration [N/N] | VERDICT`.

- [ ] F4. **Scope Fidelity Check** — `deep`
  Compare actual diff to this plan. Reject missing pages, placeholder pages, scope creep, unplanned providers, direct Gmail/Sheets frontend calls, or duplicate export behavior. Output: `Tasks [N/N compliant] | Scope [CLEAN/N issues] | VERDICT`.

---

## Commit Strategy

- Wave 1 commit: `test(infra): add frontend and backend test foundations`
- Wave 2 commit: `feat(schema): add shared dashboard foundations`
- Wave 3 commit: `feat(front-office): add operational property pages`
- Wave 4 commit: `feat(revenue-admin): add revenue and admin pages`
- Wave 5 commit: `feat(tax-export): add email-to-sheet backend`
- Wave 6 commit: `feat(tax-ui): add export UI and page actions`
- Wave 7 commit: `feat(integrations): harden WithOne connector flow`
- Final fixes commit: `fix(qa): address final verification findings`

---

## Success Criteria

### Verification Commands
```bash
npm run typecheck
npm run build
cd backend && npm run build
cd backend && npm run db:generate
cd backend && npm run db:validate
cd backend && npm run db:verify:migration
```

### Final Checklist
- [ ] All 11 missing sidebar pages implemented.
- [ ] Existing routed pages still work.
- [ ] Tax-Export same-day checkout flow works under mocked WithOne.
- [ ] Duplicate export rerun updates existing row, not duplicate append.
- [ ] Low-confidence/missing email cases go to `needs_review`.
- [ ] WithOne disconnected state is actionable.
- [ ] All tests and agent QA pass.
