# ADR: listing_room_mappings Composite Uniqueness

## Context

`backend/prisma/schema.prisma:203-219` defines `listing_room_mappings` with `id`, `channel_listing_id`, `room_id`, `mapping_role`, `status`, `sort_order`, `notes`, timestamps, relations, and only `@@index([channel_listing_id, room_id])`; it does not currently enforce uniqueness for `(channel_listing_id, room_id, mapping_role)`. The relation uses `onDelete: Cascade` for `channel_listing_id` and `onDelete: Restrict` for `room_id`. `backend/prisma/AGENTS.md:20-25` requires additive Track B Prisma migrations and new migrations instead of drift-hiding edits. Current listing ingest in `backend/src/ingest/services/listings.ts:193-205` only creates a mapping when no mapping exists for the listing, while the planned `seed-listings-sot` flow will replace composite mappings inside a transaction with `deleteMany` then `createMany`. A read-only Azure query returned `duplicateGroups: 0` for `SELECT channel_listing_id, room_id, mapping_role, COUNT(*) FROM listing_room_mappings GROUP BY 1,2,3 HAVING COUNT(*) > 1`.

## Options Considered

- **YES: add additive Prisma uniqueness later in T8.** Add `@@unique([channel_listing_id, room_id, mapping_role])` as a defense-in-depth guard after confirming no existing duplicate groups.
- **NO: keep only app-level idempotency.** Rely on current create-if-missing ingest and future `deleteMany` + `createMany` seeding, avoiding any schema constraint.

## Decision

**YES.** Add an additive Prisma migration for `@@unique([channel_listing_id, room_id, mapping_role])` in T8, but do not apply it in this ADR task. Existing Azure data has zero duplicate groups, so the constraint is safe to introduce without dedupe. The composite key includes `mapping_role`, preserving valid S5 composite listings where one `channel_listing_id` maps to multiple rooms with `mapping_role = "composite_component"` and distinct `sort_order`; each row still differs by `room_id`. T8 status: **ACTIVE**.

Draft schema diff for T8 only:

```prisma
model listing_room_mappings {
  // existing fields and relations unchanged
  @@unique([channel_listing_id, room_id, mapping_role])
  @@index([channel_listing_id, room_id])
}
```

## Consequences

- Prevents accidental future duplicate mappings for the same listing, room, and role.
- Keeps composite-room mappings valid because uniqueness is not just on `channel_listing_id`.
- Turns duplicate insertion bugs into immediate DB errors instead of silent data drift.
- Requires T8 to update `schema.prisma` first, generate/review a Prisma migration, and keep schema and migration together.
- Does not replace app-level idempotency; `seed-listings-sot` should still use transactional `deleteMany` + `createMany`.

## Verification Plan

- Re-run the duplicate check before T8 migration work: `SELECT channel_listing_id, room_id, mapping_role, COUNT(*) FROM listing_room_mappings GROUP BY 1,2,3 HAVING COUNT(*) > 1` and require `0` rows.
- In T8, edit only `backend/prisma/schema.prisma` plus the generated migration.
- Run from `backend/`: `npm run db:generate`, `npm run db:validate`, `npm run db:verify:migration`, and `npm run build`.
- Confirm migration SQL is additive, Azure-safe, and contains no Supabase RLS syntax.
