# Plan: listings.csv -> channel_listings reconciliation (v4)

**Status:** awaiting user approval
**Started:** 2026-06-13
**Last revised:** 2026-06-13T07:51Z
**Owner:** Sisyphus (after approval)
**Mode:** ULW (TDD, atomic commits)
**Supersedes:** plan v1-v3 (this file's prior content)

---

## TL;DR

Wipe `channel_listings` and downstream FK-bound rows on Azure, then re-insert
exactly the 59 rows defined by `docs/database_design/listings.csv`, tagged with
`owner` and `source_metadata` per the precedence **Ruby > Manuka > listings**.

- Deliverable: `channel_listings` count = 59 with correct `owner` + `source_metadata`.
- Effort: Medium (2 schema-aware tasks + 1 wipe-reload script + 4 tests).
- Sequential: yes - data wipe must finish before re-insert.
- Critical path: Phase A (T7 update) -> Phase B (T9 rewrite) -> Phase C (verify).

---

## Context

### Original ask
"Make listings.csv (and Ruby.csv, Manuka.csv) the canonical source of truth for
channel_listings. Listings can drift to a different room within the same
building silently; cross-building requires admin opt-in."

### Architecture (per user, restated v4)
- `listings.csv` is the **canonical set**: 59 IDs define which provider_listing_id
  values may exist in `channel_listings`.
- `Ruby.csv` and `Manuka.csv` are **ownership tags only**, NOT data overrides.
  They do not change `internal_name`, `title`, or `public_url` - those stay
  sourced from `listings.csv`.
- Precedence (highest wins for `owner` field): **Ruby > Manuka > listings**.
- Per-CSV row metadata observations (Manuka's Vietnamese title, Ruby's status
  code, etc.) are recorded in `source_metadata` JSON without mutating canonical
  fields.

### Critical research findings (validated this session)

**FINDING 1 - existing schema already supports this model:**
`channel_listings` model (schema.prisma lines 153-182) already has:
- `owner String @default("mujo")` (line 157)
- `source_metadata Json @default("{}")` (line 168)
- `@@unique([provider_listing_id])` (line 179) - prevents intra-DB duplicates

No schema changes needed for ownership tagging.

**FINDING 2 - FK cascade map for wipe:**
- `channel_listing_aliases` -> `onDelete: Cascade` (auto-wiped with parent)
- `listing_room_mappings` -> `onDelete: Cascade` (auto-wiped with parent)
- `reservation_external_refs.channel_listing_id` -> `onDelete: Restrict`
- `provider_reservation_import_rows.resolved_channel_listing_id` -> `onDelete: Restrict`

The two `Restrict` FKs block a naive wipe. Plan must explicitly clear or null
them before wiping `channel_listings`.

**FINDING 3 - Manuka.csv status is Vietnamese:**
`Manuka.csv` Status column = `"Đã đăng"`, not `"Listed"`. The current
`parseListingsCsv` filter `status.toLowerCase() === "listed"` silently drops
all 4 Manuka rows. Plan must accept multilingual "listed" markers OR change
the filter to a denylist (drop only "In progress").

**FINDING 4 - precision-loss bug already fixed:**
`backend/src/ingest/normalizer.ts:109` now passes `{ raw: false, defval: "" }`
to `xlsx.utils.sheet_to_json`. 19-digit IDs preserved as strings. Future
imports won't recreate the precision-loss surplus.

**FINDING 5 - existing services/listings.ts pattern:**
The original ingest code at `services/listings.ts:219-262` treats title-only
Ruby/Manuka rows as `channel_listing_aliases`, NOT as separate primary
listings. v4's "single canonical row per provider_listing_id with
owner+source_metadata" model aligns with this pattern.

---

## Scope

### Must Have
- After apply: `SELECT COUNT(*) FROM channel_listings` = **59** on Azure.
- Each of the 59 rows has correct `owner` per **Ruby > Manuka > listings**.
- Each row's `source_metadata` JSON contains entries for every CSV that listed
  the ID (key = csv name, value = original row payload).
- `internal_name`, `title`, `public_url` always sourced from listings.csv.
- Idempotent: second `--apply` produces zero changes, exits 0.
- Default mode is `--check` (read-only).
- `--apply` against Azure refuses without env `JM_LISTINGS_SOT_AZURE_OK=1`.
- All 19 existing T3 tests pass; new ownership/precedence tests pass.
- `npm run build` clean.

### Must NOT Have
- No Prisma schema changes (existing columns suffice).
- No new migrations.
- No mutation of `internal_name`, `title`, or `public_url` from Ruby/Manuka data.
- No auto-creation of new properties or rooms.
- No bypass of the FK Restrict on `reservation_external_refs` without explicit
  user-confirmed handling (see Open Question Q1 below).
- No silent cross-building drift unless `--allow-cross-building` is passed.

### Out of Scope
- Reservation re-ingestion (separate follow-up task once listings clean).
- Frontend changes.
- Touching `parser.ts`, `normalizer.ts`, or other ingest services.

---

## TODOs

### Phase A - T7 module updates (no DB writes; depends on: nothing)

- [x] 1. Extend `ListingsCsvRow` with `owner` and `sourceMetadata`
  - File: `backend/src/lib/listings-source-of-truth.ts`.
  - Add fields: `owner: "ruby" | "manuka" | "listings"`, `sourceMetadata: Record<string, unknown>`.
  - Update `parseListingsCsv` to accept optional 2nd arg `csvName` (default `"listings"`).
  - Loosen status filter: drop only rows whose status matches `/^in.progress$/i`. Keep `"Listed"`, `"Đã đăng"`, etc. Addresses Manuka filter bug (FINDING 3).
  - Acceptance: `parseListingsCsv(manukaCsv, "manuka")` returns 4 rows (currently 0). All 19 existing tests still pass.

- [x] 2. Add `mergeCsvWithOwnership` helper
  - New exported function: `mergeCsvWithOwnership({ listings, ruby, manuka }: { listings: string; ruby: string; manuka: string }): ListingsCsvRow[]`.
  - Canonical set = `listings.csv` IDs only. Drop any Ruby/Manuka row whose ID is absent from listings.csv.
  - Per canonical ID, owner = highest-precedence CSV that lists it: **Ruby > Manuka > listings**.
  - `internalName`, `title`, `url`, `providerListingId` ALWAYS sourced from listings.csv (no override from Ruby/Manuka).
  - `sourceMetadata` = union of per-CSV observations: `{ ruby?: {...}, manuka?: {...}, listings: {...} }`.
  - Acceptance: result length = 59; ID 33932700 -> owner `"ruby"`, internal_name `"LL - Latte 1"`, source_metadata has all 3 keys.

- [x] 3. Update `classifyDbRowsAgainstCsv` for owner-aware drift
  - Drift detection compares DB `internal_name` vs CSV (existing) AND DB `owner` vs merged owner (new).
  - Add `ownerDrift: boolean` field to `DriftResolution`.
  - Acceptance: existing 4 classify tests pass; new test where DB owner=`"mujo"`, merged owner=`"ruby"` produces a drift fix.

- [x] 4. Add 6 new T3 tests for ownership + precedence + multilingual filter
  - Test fixtures: small inline CSV strings simulating listings/Ruby/Manuka.
  - Cases:
    1. `mergeCsvWithOwnership` with all 3 CSVs returns 59 rows (when fed real fixtures).
    2. ID 33932700: `owner === "ruby"`, `internalName === "LL - Latte 1"` (Ruby precedence; listings.csv data).
    3. ID 947584081523929277: `owner === "ruby"` (Ruby beats Manuka).
    4. ID 1027327396117322855: `owner === "ruby"` (Ruby beats Manuka).
    5. Manuka.csv parses to owner=`"manuka"`, 4 rows (status filter accepts `"Đã đăng"`).
    6. Empty internal_name + status=`"In progress"` row is dropped.
  - Acceptance: total tests = 25/25 pass.

### Phase B - T9 wipe-and-reload script (depends on: Phase A complete)

- [x] 5. Replace `seed-listings-sot.ts` body with wipe-and-reload flow
  - File: `backend/scripts/seed-listings-sot.ts` (replace existing body).
  - Read 3 CSVs via `readFile`. Build merged set with `mergeCsvWithOwnership`.
  - Resolve `external_account_id` via single Prisma query: `prisma.external_accounts.findFirst({ where: { channel: { slug: "airbnb" }, account_key: "airbnb-main" } })`. Fail loudly if missing.
  - For each merged row, resolve room IDs via `normalizeListingInternalName` + `prisma.rooms.findFirst({ property.slug, room_number })`. Composite split for `"Milk 2 & Coffee 2"` etc.
  - In `--check` mode: print full plan (delete count, insert count, ref-clear count, room resolution per row), exit 0.
  - In `--apply` mode: see Tasks 6-8 below.
  - Acceptance: `--check` against Azure prints expected counts; build clean.

- [x] 6. Implement wipe phase inside transaction
  - Inside `prisma.$transaction(async (tx) => { ... })`:
    1. `tx.provider_reservation_import_rows.updateMany({ where: { resolved_channel_listing_id: { not: null } }, data: { resolved_channel_listing_id: null } })`. Per Q2.
    2. `tx.reservation_external_refs.deleteMany({})` (option A) OR capture-and-repoint (option B). Per Q1.
    3. `tx.channel_listings.deleteMany({})` (cascades to channel_listing_aliases + listing_room_mappings).
  - Acceptance: post-wipe in same tx, `tx.channel_listings.count() === 0`.

- [x] 7. Implement re-insert phase inside same transaction
  - For each merged CSV row, in listings.csv order:
    1. `tx.channel_listings.create({ data: { external_account_id, provider_listing_id, owner, title, internal_name, public_url, host_editor_url, extracted_at, source_metadata, status: "listed" } })`.
    2. For each resolved roomId (composite-split aware): `tx.listing_room_mappings.create({ data: { channel_listing_id, room_id, mapping_role: "full_occupancy", sort_order } })`.
  - Acceptance: post-insert in same tx, `tx.channel_listings.count() === 59`.

- [x] 8. Idempotency guard + Azure env gate
  - Before any mutation in `--apply`: if Azure DB AND `process.env.JM_LISTINGS_SOT_AZURE_OK !== "1"`, exit 2 with explicit message.
  - After successful apply, run a second `--check` programmatically and assert 0 changes pending. If non-zero, log warning and exit 1.
  - Acceptance: second `--apply` against Azure produces zero changes (verified by script logging).

### Phase C - Verification + handoff (depends on: Phases A+B complete)

- [x] 9. Run full test + build gate
  - Commands:
    - `cd backend && npm run build`
    - `npx tsx --test test/listings-sot.test.ts`
    - `npm run db:validate && npm run db:verify:migration`
  - Acceptance: all 3 exit 0.

- [x] 10. Dry-run `--check` against Azure, capture output
  - Command: `cd backend && npm run seed:listings-sot > .omo/evidence/listings-sot-check-$(date).txt`
  - Acceptance: report shows 59 INSERTs planned, N orphan DELETEs, N reservation-ref clears.
  - User reviews output before approving `--apply`.

- [x] 11. `--apply` against Azure (after explicit user confirmation)
  - Command: `JM_LISTINGS_SOT_AZURE_OK=1 cd backend && npm run seed:listings-sot:apply`
  - Acceptance:
    - Post-state: `channel_listings` count = 59.
    - Owner distribution matches Q3-confirmed counts.
    - All listings have at least 1 active mapping (composite rooms have 2).
    - Re-running `--apply` produces 0 changes.

- [x] 12. Reservation re-ingest follow-up + status update
  - Re-ingest `docs/database_design/reservations.csv` via existing endpoint.
  - Acceptance: dead-letter count drops from 28 to target (ideally 0).
  - Update `docs/status.md` with the listings-sot rollout outcome.
  - Atomic commits per task (see Commit Strategy below).

---

## Verification Strategy

- Build gate: `cd backend && npm run build` exit 0.
- Unit tests: `npx tsx --test test/listings-sot.test.ts` -> all green.
- Schema gate: no migration needed, but confirm `npm run db:validate` and
  `npm run db:verify:migration` still pass.
- Pre-apply dry-run: `npm run seed:listings-sot` against Azure -> reports
  exactly 59 INSERTs, N DELETEs of orphan listings, count of refs to clear.
- Apply gate: `JM_LISTINGS_SOT_AZURE_OK=1 npm run seed:listings-sot:apply`
  followed by inspector script that asserts:
  - `channel_listings` count = 59
  - owners distribution matches expected (~13 ruby, ~4 manuka, ~42 listings -
    final exact numbers depend on CSV intersections, computed in Phase A.4).
  - `listing_room_mappings` populated for every active row.
- Idempotency gate: re-run `--apply` -> 0 changes, exit 0.
- Reservation regression follow-up: re-ingest `reservations.csv` -> dead-letter
  count drops from 28 to <= remaining truly-ambiguous edge cases (target 0).

---

## Open Questions (BLOCKING - need answer before Sisyphus starts)

**Q1. `reservation_external_refs` handling on wipe.** Two options:
- **A. Wipe entirely** alongside `channel_listings`. Reservations stay in
  `reservations` table but lose provider linkage. Operator re-ingests
  reservations.csv after listings rebuild. (User's "remove all the registered
  data" reads literally as this.)
- **B. Capture-and-repoint.** Before delete: snapshot `(ref_id, provider_listing_id)`.
  After re-insert: rebuild `channel_listing_id` references by joining on
  `provider_listing_id`. Refs whose provider ID isn't in the canonical 59 are
  dropped.

Recommendation: **A**. Simpler, matches user wording, reservation re-ingest
already on the roadmap. Sisyphus needs explicit confirmation before either path.

**Q2. `provider_reservation_import_rows.resolved_channel_listing_id`.** Same
choice: clear all (set to NULL) before wipe, or capture-and-repoint? These rows
are import audit logs, not active state. Recommendation: clear to NULL.
Confirmation required.

**Q3. `external_account_id` for the 59 rows.** Single airbnb-main account UUID
for all? (The pre-apply DB shows existing rows already keyed to one account;
research confirmed in this session.) Recommendation: yes, single account.
Inspector script will print the exact UUID for the plan to embed.

**Q4. Manuka status filter.** Accept "Đã đăng" (Vietnamese for "Listed") as
equivalent to "Listed", OR change filter to "drop only 'In progress'"?
Recommendation: latter - more permissive, matches the spirit of the source
files which all share the same column position.

---

## Execution Strategy

Sequential. The wipe must complete before reload. Within the reload, room
mapping resolution can parallelise per row but that's a Sisyphus implementation
detail, not plan-level concurrency.

---

## Final Verification Wave (parallel reviews after implementation)

- [ ] F1. Plan compliance audit (oracle)
- [ ] F2. Code quality review (unspecified-high)
- [ ] F3. Real manual QA (unspecified-high)
- [ ] F4. Scope fidelity check (deep)

---

## Commit Strategy

Atomic commits per task; commit message format `type(scope): desc`.
Final commit: `docs(plans): mark listings SoT v4 complete + status update`.

---

## Success Criteria

- [ ] `channel_listings` count on Azure = 59
- [ ] Owner distribution matches Ruby > Manuka > listings precedence
- [ ] `source_metadata` populated correctly for all 59 rows
- [ ] All existing tests still pass
- [ ] Reservation dead-letter count after re-ingest reaches 0 (or stable target)
- [ ] Idempotent: second `--apply` produces 0 changes
