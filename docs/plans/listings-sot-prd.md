# PRD: Listings CSV as channel_listings Source of Truth

**Type:** Scrum PRD (one-shot agent implementation target)
**Project:** Just Management - Hospitality Operations Dashboard
**Feature:** listings.csv canonical seed with ownership hierarchy
**Status:** Final (retrospective - written after implementation)
**Date:** 2026-06-13

---

## 1. Problem Statement

The channel_listings table on Azure contained 111 rows despite the canonical inventory being 59.
Root cause: xlsx.utils.sheet_to_json parses 19-digit Airbnb IDs as JS Number, truncating digits
due to IEEE-754 binary64 limits (~16 safe decimal digits). The 52 surplus rows had res_refs=0.
This caused 28 reservations to dead-letter with AMBIGUOUS_LISTING_MATCH.

Three CSV files define listing inventory from different Airbnb host accounts.
The system had no concept of which account owned which listing.

---

## 2. Business Goals

1. Reduce channel_listings to exactly 59 rows matching the canonical CSV inventory.
2. Tag each listing with its rightful owner account (Manuka > Ruby > listings precedence).
3. Capture per-account raw metadata in source_metadata without overriding canonical fields.
4. Unblock 28 dead-lettered reservations (target: 0 dead-letters after re-ingest).
5. Prevent precision-loss from recurring on future imports.

---

## 3. Non-Goals

- Do NOT change internal_name, title, public_url based on Ruby/Manuka data.
- Do NOT auto-create properties or rooms.
- Do NOT modify API response shapes or frontend code.
- Do NOT modify reservation data beyond re-ingesting after listings rebuild.

---

## 4. Domain Model (Read This Before Implementing)

### 4.1 CSV Hierarchy and Ownership

Three CSV files exist with a strict ownership hierarchy:

  Manuka.csv  (4 rows)   Highest authority. Manuka account owns these listings.
  Ruby.csv    (13 rows)  Ruby account. All 4 Manuka IDs are ALSO in Ruby.
  listings.csv (59 rows) Full canonical inventory. All Manuka + Ruby IDs are subsets.

Ownership rule: Manuka > Ruby > listings
  - ID in Manuka.csv -> owner = manuka
  - ID in Ruby.csv but NOT Manuka.csv -> owner = ruby
  - Otherwise -> owner = listings

CRITICAL: Ruby contains all 4 Manuka IDs plus 9 more.
Manuka is the RIGHTFUL OWNER of those 4 shared IDs.
Ruby INHERITS from Manuka for those 4 IDs.
Final counts: manuka=4, ruby=9, listings=46 (total=59).

### 4.2 CSV Schema (identical across all three files)

  Columns: ID, Title, Internal Name, Type, Location, Status, Host Editor URL, Public URL, Extracted At

CRITICAL: Manuka.csv was exported from the Vietnamese Airbnb UI.
  listings.csv + Ruby.csv: Status = Listed
  Manuka.csv: Status = Da dang (Vietnamese for Listed)

Status filter rule: DROP rows where status matches /^in[\s-]?progress$/i only.
Never use exact string match on Listed. Accept all non-progress statuses.

### 4.3 Existing Schema (no changes needed)

channel_listings already has:
  owner String @default(mujo)    <- will be set to manuka/ruby/listings
  source_metadata Json @default({})
  @@unique([provider_listing_id]) <- prevents duplicates
  @@index([owner])

FK cascade map for wipe:
  channel_listing_aliases -> onDelete: Cascade (auto-wiped with parent)
  listing_room_mappings -> onDelete: Cascade (auto-wiped with parent)
  reservation_external_refs.channel_listing_id -> onDelete: Restrict (DELETE first)
  provider_reservation_import_rows.resolved_channel_listing_id -> onDelete: Restrict (NULL first)

### 4.4 Internal Name to Room Mapping

Format: {PropertyPrefix} - {RoomName}
Prefix to slug: MH->mh, 23->23, CC->cc, LL->ll, TC->tc, TheO->theo, TA->ta, Ruby->ruby

Drift catalog (surplus names -> canonical SoT rooms, all within_building):
  tc + 8.05 -> C 8.05
  tc + C12.02 -> C 12.02
  ll + coffee 3 -> Coffee 3 (case-insensitive)
  ll + Latte 1 -> Latte
  theo + B20.12A Main -> B20.12A
  ta + The Alley 1 -> Alley 1

Composite: LL - Milk 2 & Coffee 2 -> two mappings. Split on /\s*&\s*|\s+and\s+/i.
Cross-building: room resolves to different property than prefix -> REJECT unless --allow-cross-building.

---

## 5. User Stories

US-1 (operator): As an operator I want channel_listings to contain exactly 59 rows matching listings.csv so that reservation matching works without ambiguity.
US-2 (operator): As an operator I want each listing tagged with its owner account so I can filter and report per Airbnb account.
US-3 (operator): As an operator I want reservations to ingest without dead-letters so that the dashboard reflects accurate occupancy.
US-4 (developer): As a developer I want a --check mode that prints the full reconciliation plan without touching the DB.
US-5 (developer): As a developer I want a --apply mode gated by JM_LISTINGS_SOT_AZURE_OK=1 so production mutations are explicit.

---

## 6. Acceptance Criteria

AC-1: After --apply, SELECT COUNT(*) FROM channel_listings = 59.
AC-2: owner distribution = manuka:4, ruby:9, listings:46.
AC-3: Every listing has at least 1 active listing_room_mappings row.
AC-4: LL - Milk 2 & Coffee 2 has exactly 2 listing_room_mappings rows.
AC-5: source_metadata contains listings key for all 59 rows.
AC-6: source_metadata contains ruby key for all 13 ruby+manuka rows.
AC-7: source_metadata contains manuka key for all 4 manuka rows.
AC-8: Running --apply a second time produces identical state (idempotent).
AC-9: After --apply, re-ingesting reservations.csv produces 0 dead-letters.
AC-10: npm run build exits 0.
AC-11: All unit tests pass (target: 25/25).
AC-12: --apply against Azure refuses without JM_LISTINGS_SOT_AZURE_OK=1.

---

## 7. Technical Specification

### 7.1 Files to Create

backend/src/lib/listings-source-of-truth.ts
  Pure logic module. No I/O, no Prisma.
  Exports:
    parseListingsCsv(csv: string, csvName?: ruby|manuka|listings): ListingsCsvRow[]
    mergeCsvWithOwnership(input: {listings,ruby,manuka}): ListingsCsvRow[]
    normalizeListingInternalName(name, opts?): NormalizedListingName
    classifyDbRowsAgainstCsv(dbRows, csvRows, opts): ClassifyResult
  Types: ListingsCsvRow, NormalizedListingName, DriftResolution, ClassifyResult, ClassifyDbRow

backend/scripts/seed-listings-sot.ts
  Wipe-and-reload CLI script.
  Flags: --check (default), --apply, --allow-cross-building
  Env gate: JM_LISTINGS_SOT_AZURE_OK=1 required for Azure --apply
  Transaction order:
    1. provider_reservation_import_rows.updateMany resolved_channel_listing_id=null
    2. reservation_external_refs.deleteMany()
    3. channel_listings.deleteMany() [cascades aliases + mappings]
    4. channel_listings.create x59 with owner + source_metadata
    5. listing_room_mappings.create per resolved room

backend/test/listings-sot.test.ts
  Unit tests using node:test and node:assert/strict.
  Minimum 25 tests covering:
    normalizeListingInternalName: exact, within_building drift, composite, cross-building error
    parseListingsCsv: status filter, 19-digit ID preservation, field mapping
    mergeCsvWithOwnership: length=59, Manuka beats Ruby, Ruby-only owner, ID not in listings dropped
    classifyDbRowsAgainstCsv: keepIds, surplusIds, missingProviderIds, driftFixes, ownerDrift

### 7.2 Files to Modify

backend/src/ingest/normalizer.ts line ~109:
  CHANGE: xlsx.utils.sheet_to_json(sheet, { defval: '' })
  TO:     xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false })
  WHY: raw:false forces all cells to strings, preserving 19-digit IDs.

backend/prisma/schema.prisma model listing_room_mappings:
  ADD: @@unique([channel_listing_id, room_id, mapping_role], name: listing_room_mappings_clr_unique)
  WHY: Prevents duplicate mappings on idempotent re-runs.

backend/package.json scripts:
  ADD: seed:listings-sot -> tsx scripts/seed-listings-sot.ts
  ADD: seed:listings-sot:apply -> tsx scripts/seed-listings-sot.ts --apply

### 7.3 Migration

File: backend/prisma/migrations/20260613000000_listing_room_mappings_clr_unique/migration.sql
Content: CREATE UNIQUE INDEX listing_room_mappings_clr_unique ON listing_room_mappings (channel_listing_id, room_id, mapping_role);
Additive only. No drops. No Supabase RLS syntax.

### 7.4 External Account

All 59 listings attach to the single existing airbnb external_account.
Query: prisma.external_accounts.findFirst({ where: { channel: { slug: airbnb } } })
Fail loudly if not found.

### 7.5 channel_listings.create field mapping

  external_account_id: from account query above
  provider_listing_id: csvRow.providerListingId (string, never Number)
  owner: manuka | ruby | listings per hierarchy
  title: csvRow.title (from listings.csv ALWAYS)
  internal_name: csvRow.internalName (from listings.csv ALWAYS)
  public_url: csvRow.url (from listings.csv ALWAYS)
  status: listed
  listing_type: home
  source_metadata: csvRow.sourceMetadata (union of per-CSV observations)

---

## 8. Implementation Order (Scrum Stories)

Sprint 1 - Pure logic + tests (no DB, no I/O):
  S1: Fix normalizer.ts xlsx raw:false (1 line, 1 test)
  S2: Write listings-source-of-truth.ts with parseListingsCsv + normalizeListingInternalName
  S3: Add mergeCsvWithOwnership to listings-source-of-truth.ts
  S4: Add classifyDbRowsAgainstCsv with owner-aware drift to listings-source-of-truth.ts
  S5: Write backend/test/listings-sot.test.ts (25 tests) - all must pass

Sprint 2 - Schema + script:
  S6: Add @@unique to listing_room_mappings in schema.prisma + create migration
  S7: Write seed-listings-sot.ts (wipe-and-reload, --check + --apply + env gate)
  S8: Wire npm scripts in package.json

Sprint 3 - Verification:
  S9: Run npm run build (must exit 0)
  S10: Run npm run seed:listings-sot (--check against Azure, review output)
  S11: Run JM_LISTINGS_SOT_AZURE_OK=1 npm run seed:listings-sot:apply
  S12: Verify: channel_listings=59, owners correct, mappings=60
  S13: Re-ingest reservations.csv via processReservationSync, verify dead-letters=0
  S14: Run --apply second time, verify idempotent (deletes=59 inserts=59 errors=0)

---

## 9. Known Gotchas (Lessons From Implementation)

G1 MANUKA STATUS: Manuka.csv Status is Vietnamese 'Da dang', not 'Listed'.
   Status filter MUST use /^in[\s-]?progress$/i denylist, NOT === 'Listed' allowlist.

G2 OWNER SEMANTICS: Manuka > Ruby > listings means Manuka WINS, not Ruby.
   Manuka is the parent account. Ruby inherits from Manuka for shared IDs.
   All 4 Manuka IDs are also in Ruby. Manuka must take precedence.

G3 PRECISION LOSS: 19-digit Airbnb IDs truncated by JS Number. Always use raw:false in xlsx.
   provider_listing_id must always be treated as a string, never a number.

G4 FK CASCADE ORDER: reservation_external_refs and provider_reservation_import_rows
   have onDelete: Restrict. They MUST be cleared before deleting channel_listings.
   channel_listing_aliases and listing_room_mappings cascade automatically.

G5 SCHEMA ALREADY HAS OWNER: Do not propose adding owner or source_metadata columns.
   They already exist. Check schema.prisma before writing migration proposals.

G6 SINGLE EXTERNAL ACCOUNT: All 59 listings share one airbnb external_account.
   Do not create separate accounts per CSV file.

G7 IDEMPOTENCY IS A WIPE: This is a full wipe-and-reload, not an upsert.
   Second --apply will delete 59 and insert 59. That is correct, not a bug.

G8 COMPOSITE ROOMS: LL - Milk 2 & Coffee 2 creates TWO listing_room_mappings rows.
   sort_order 1 and 2. Do not skip or error on ampersand in room names.

G9 DRIFT CATALOG IS NOT OPTIONAL: TC - 8.05 must resolve to C 8.05 or the room insert fails.
   All drift rules from merge-surplus-rooms.ts must be encoded in the SoT module.

G10 EXACT MATCH IS CASE-SENSITIVE: Use exact case match first, then drift catalog.
    Do NOT use case-insensitive exact match or 'coffee 3' will return 'exact' instead of within_building.

---

## 10. Verification Commands

  cd backend && npm run build                                    # must exit 0
  cd backend && npx tsx --test test/listings-sot.test.ts        # must show 25 pass 0 fail
  cd backend && npm run db:validate                             # schema valid
  cd backend && npm run db:verify:migration                     # Azure-safe migration
  cd backend && npm run seed:listings-sot                       # --check, review output
  JM_LISTINGS_SOT_AZURE_OK=1 npm run seed:listings-sot:apply   # apply
  # Post-apply assertions:
  # channel_listings = 59
  # listing_room_mappings = 60
  # owner distribution: manuka=4, ruby=9, listings=46
  # reservation re-ingest dead-letters = 0