# Draft: Dashboard Pages + Tax-Export + Integration Architecture

> Working memory for the planning session. This draft will be deleted once the final plan is committed to `.omo/plans/`.

## Original Request (verbatim)
> Please proceed to construct a complete plan of implementation for other pages within the current dashboard. Additionally, create a complete button to establish a feature called "Tax - Export". Which export based on the existing google sheet template. Additionally, please create a plan thorough and in-depth for each of the other pages currently within the dashboard. Please be advised that the integrations of 3rd parties will mostly be through the withone API for unified API interface.

## Initial Interpretation (to be confirmed)
This is a **single, large work plan** covering three intertwined initiatives:
1. **Dashboard pages implementation** - finish all pages currently scaffolded in `src/router.tsx` beyond the main dashboard
2. **Tax-Export feature** - a button + flow that exports tax data into a pre-existing Google Sheet template
3. **Third-party integration architecture** - establish "WithOne" (One CLI / One API) as the unified gateway for all external integrations

Per single-plan mandate, all three go into ONE plan at `.omo/plans/dashboard-completion-and-integration.md`.

## Intent Classification
- **Primary**: Build From Scratch (multiple new pages + new feature + new integration layer)
- **Secondary**: Architecture (One adapter/gateway pattern)
- **Tertiary**: Mid-sized Task (Tax-Export is bounded)

## SDD Framework Detection
- openspec/: NOT FOUND
- .specify/: NOT FOUND
- _bmad/: NOT FOUND
- Decision: No SDD framework. Plan is the source of truth.

## Research In Flight (background)
- bg_51cf08d6 - Inventory of every page/route in the dashboard, status, hooks, repositories
- bg_367c8d46 - Existing tax/export/Google-Sheets surface area in repo
- bg_4e344108 - Existing integration seams, ingest pipeline, provider edges
- bg_97fb49fc - Vietnamese tax authority guidance + Google Sheets API library recommendation

## Requirements (confirmed)
- One complete plan, not split plans.
- Fully implement all 11 sidebar-advertised missing pages.
- Add Tax-Export feature centered on same-day checkout reservations.
- Tax-Export uses existing WithOne Gmail connection to find payment emails by reservation confirmation code.
- Tax-Export writes parsed payment rows to one shared user-provided Google Sheet template.
- v1 email parsers: Airbnb, Booking.com, Agoda, generic/pluggable fallback.
- Multi-property behavior throughout all pages and export flows.
- WithOne broader third-party work is architecture-prep only, not live provider rollout.
- Testing must be set up first; TDD required.

## Technical Decisions
- Frontend test framework: Vitest.
- Backend test framework: Node built-in test runner.
- Tax-Export date default: checkout date equals local property today; fallback timezone `Asia/Ho_Chi_Minh`.
- Tax-Export row strategy: idempotent upsert by `reservation_id + checkout_date + confirmation_code`.
- Settings model: one shared sheet now; note future per-user/per-tenant settings.
- Schema strategy: lean foundations first, page-specific expansions in page tasks.
- WithOne architecture: backend-only adapter/port; frontend never calls Gmail/Sheets directly.

## Scope Boundaries
- INCLUDE: 11 missing pages, existing button gaps, Tax-Export page/action/scheduler, Gmail parser registry, Sheets write path, lean audit/config schema, ProviderConnector abstraction, frontend/backend tests, agent QA.
- EXCLUDE: Full PMS platform, full accounting platform, new live OTA/channel-manager provider integration, broad payment provider integration, full tax-law calculation engine, direct frontend Gmail/Sheets calls, Supabase runtime revival.

## Open Questions
- None blocking. Metis defaults accepted for timezone, idempotency, needs-review behavior, privacy, and connector guardrails.

## Research Findings
- _Awaiting agents._

## References
- AGENTS.md - Track B REST architecture, Harbor/Brass theme tokens
- backend/AGENTS.md, backend/prisma/AGENTS.md, backend/src/ingest/AGENTS.md - subsystem rules
- src/lib/repositories/AGENTS.md - frontend repository contract rules

## Confirmed Decisions (round 2)

### Tax-Export behavior
- Primary workflow: export reservations whose checkout date equals submission date/today.
- Today example: if today is 2026-05-29, default export includes only reservations with checkout date `2026-05-29`.
- UI entry points in scope:
  - Dedicated Tax & Compliance page.
  - Per-reservation row action.
  - Scheduled / automated runs.
- Bulk date range is not primary; same-day checkout is primary default.
- Sheet template: user will provide Google Sheet URL/ID during implementation.
- All listings/accounts use same sheet for now.
- Future note: plan should preserve path for per-user or per-tenant global settings later.

### Email extraction
- Gmail already connected through WithOne; executor should leverage existing connection.
- Future Gmail models should remain extensible.
- v1 parser formats: Airbnb, Booking.com, Agoda, plus generic/pluggable parser registry.
- Confirmation code is lookup key: reservation -> confirmation code -> Gmail search -> payment email -> extraction -> sheet row.

### Missing pages
- All 11 sidebar-planned pages must be fully implemented in this single plan:
  1. Check-in / Check-out
  2. VIP Guests
  3. Room Types
  4. Availability
  5. Housekeeping
  6. Dining & Events
  7. Rate Manager
  8. Billing & Invoices
  9. Channel Distribution
  10. Staff & Roles
  11. Security & Access

### Testing
- Frontend: Vitest.
- Backend: Node built-in test runner.
- Direction: set up test infrastructure first, then TDD everything.
- Agent-executed QA remains mandatory for every task.

### Schema scope
- Lean now, expand per page.
- Avoid one giant revenue schema upfront.
- Add minimal shared foundations early; page-specific schema changes belong with the page task that needs them.

### WithOne
- Architectural prep only for broader third-party integrations.
- No new live OTA/provider integration beyond Gmail/Sheets needed in this plan.
- Establish connector abstractions and remove hardcoded Airbnb-only source account limitations where needed.

## Metis Review

### Verdict
- CLEAR TO PLAN WITH DEFAULTS.

### Defaults accepted into plan
- Tax-Export export set: reservations with checkout date equal to local property today, fallback `Asia/Ho_Chi_Minh`.
- Tax-Export idempotency key: `reservation_id + checkout_date + confirmation_code`.
- Shared Google Sheet strategy: upsert rows by idempotency key, never blind append.
- Missing confirmation code/email match/low-confidence parse: mark `needs_review`, do not fail whole batch.
- Backend owns Gmail/Sheets orchestration and audit. Frontend only triggers jobs/config/status.
- No raw email body persisted by default; store Gmail message ID plus parsed fields and redacted audit.
- External WithOne calls mocked in tests behind adapter ports.
- All 11 missing sidebar routes are real production pages, not placeholders.
- Every page must include property filter, loading/empty/error states, and tests.

### Guardrails accepted
- No full PMS/payments/accounting platform in this plan.
- No new live providers beyond Gmail/Sheets pipeline.
- No direct Gmail/Sheets calls from frontend.
- No one-size-fits-all dashboard mega-abstraction.
- No full tax-law calculation engine; template/config owns accountant-specific formulas.
