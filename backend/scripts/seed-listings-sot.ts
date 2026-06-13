/**
 * Listings Source-of-Truth wipe-and-reload seed.
 *
 * Wipes channel_listings (and all cascade/FK-dependent rows) then
 * re-inserts exactly the 59 rows defined by listings.csv, tagged with
 * owner + source_metadata per precedence Ruby > Manuka > listings.
 *
 * SAFETY:
 * - Default mode (--check) is read-only. Prints full plan, exits 0.
 * - --apply wipes then reloads. Refuses Azure without JM_LISTINGS_SOT_AZURE_OK=1.
 * - --allow-cross-building permits cross-building room drift (admin only).
 *
 * Run:
 *   npm --prefix backend run seed:listings-sot                    # check
 *   npm --prefix backend run seed:listings-sot -- --apply         # local apply
 *   JM_LISTINGS_SOT_AZURE_OK=1 npm --prefix backend run seed:listings-sot -- --apply
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import {
  mergeCsvWithOwnership,
  normalizeListingInternalName,
  type ListingsCsvRow,
} from "../src/lib/listings-source-of-truth";

const prisma = new PrismaClient();
const CSV_DIR = path.resolve(__dirname, "..", "..", "docs", "database_design");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunOptions {
  apply: boolean;
  check: boolean;
  allowCrossBuilding: boolean;
}

interface ResolvedRow {
  csvRow: ListingsCsvRow;
  roomIds: string[];
  roomNames: string[];
  unresolvedReason?: string;
}

interface CheckPlan {
  mergedRows: ListingsCsvRow[];
  resolved: ResolvedRow[];
  externalAccountId: string;
  currentDbCount: number;
}

interface ApplyTotals {
  refsCleared: number;
  importRowsNulled: number;
  listingsDeleted: number;
  listingsInserted: number;
  mappingsInserted: number;
  unresolvedMappings: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Options + guards
// ---------------------------------------------------------------------------

function parseOptions(argv: string[]): RunOptions {
  const apply = argv.includes("--apply");
  const check = argv.includes("--check") || !apply;
  const allowCrossBuilding = argv.includes("--allow-cross-building");
  return { apply, check, allowCrossBuilding };
}

function isAzureDatabase(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.includes("postgres.database.azure.com");
}

// ---------------------------------------------------------------------------
// Room resolution
// ---------------------------------------------------------------------------

async function resolveRoomIds(
  csvRow: ListingsCsvRow,
  opts: RunOptions,
): Promise<{ roomIds: string[]; roomNames: string[] } | { error: string }> {
  const resolved = normalizeListingInternalName(csvRow.internalName, {
    allowCrossBuilding: opts.allowCrossBuilding,
  });
  if (resolved.errorCode || !resolved.propertySlug || resolved.roomNumbers.length === 0) {
    return { error: resolved.error ?? resolved.errorCode ?? "UNKNOWN_RESOLUTION_ERROR" };
  }
  const property = await prisma.properties.findUnique({
    where: { slug: resolved.propertySlug },
    select: { id: true },
  });
  if (!property) {
    return { error: `Property not found in DB: ${resolved.propertySlug}` };
  }
  const roomIds: string[] = [];
  for (const roomName of resolved.roomNumbers) {
    const room = await prisma.rooms.findFirst({
      where: { property_id: property.id, room_number: roomName },
      select: { id: true },
    });
    if (!room) {
      return { error: `Room not found: ${resolved.propertySlug}/${roomName}` };
    }
    roomIds.push(room.id);
  }
  return { roomIds, roomNames: resolved.roomNumbers };
}

// ---------------------------------------------------------------------------
// Build check plan
// ---------------------------------------------------------------------------

async function buildCheckPlan(opts: RunOptions): Promise<CheckPlan> {
  const [listingsCsv, rubyCsv, manukaCsv] = await Promise.all([
    readFile(path.join(CSV_DIR, "listings.csv"), "utf-8"),
    readFile(path.join(CSV_DIR, "Ruby.csv"), "utf-8"),
    readFile(path.join(CSV_DIR, "Manuka.csv"), "utf-8"),
  ]);
  const mergedRows = mergeCsvWithOwnership({
    listings: listingsCsv,
    ruby: rubyCsv,
    manuka: manukaCsv,
  });

  const account = await prisma.external_accounts.findFirst({
    where: { channel: { slug: "airbnb" }, account_key: "airbnb-main" },
    select: { id: true, account_key: true },
  });
  if (!account) {
    console.error("No airbnb external_account found. Run listings ingest first.");
    process.exit(1);
  }

  const currentDbCount = await prisma.channel_listings.count();

  const resolved: ResolvedRow[] = [];
  for (const csvRow of mergedRows) {
    const result = await resolveRoomIds(csvRow, opts);
    if ("error" in result) {
      resolved.push({ csvRow, roomIds: [], roomNames: [], unresolvedReason: result.error });
    } else {
      resolved.push({ csvRow, roomIds: result.roomIds, roomNames: result.roomNames });
    }
  }

  return { mergedRows, resolved, externalAccountId: account.id, currentDbCount };
}

// ---------------------------------------------------------------------------
// Print check plan
// ---------------------------------------------------------------------------

function printCheckPlan(plan: CheckPlan): void {
  const ownerCounts = { ruby: 0, manuka: 0, listings: 0 };
  for (const r of plan.resolved) ownerCounts[r.csvRow.owner]++;
  const unresolved = plan.resolved.filter((r) => r.unresolvedReason);
  const totalMappings = plan.resolved.reduce((s, r) => s + r.roomIds.length, 0);

  console.log("\n=== CSV merged inventory ===");
  console.log(`  Total rows:        ${plan.mergedRows.length}`);
  console.log(`  owner=ruby:        ${ownerCounts.ruby}`);
  console.log(`  owner=manuka:      ${ownerCounts.manuka}`);
  console.log(`  owner=listings:    ${ownerCounts.listings}`);

  console.log("\n=== DB current state ===");
  console.log(`  channel_listings:  ${plan.currentDbCount} rows (will be wiped in --apply)`);

  console.log("\n=== Apply plan ===");
  console.log(`  NULL  provider_reservation_import_rows.resolved_channel_listing_id`);
  console.log(`  DELETE reservation_external_refs:  all rows`);
  console.log(`  DELETE channel_listings:           ${plan.currentDbCount} rows (cascades aliases+mappings)`);
  console.log(`  INSERT channel_listings:           ${plan.mergedRows.length} rows`);
  console.log(`  INSERT listing_room_mappings:      ${totalMappings} rows`);

  if (unresolved.length > 0) {
    console.log(`\n--- Unresolved room mappings (${unresolved.length}) ---`);
    for (const r of unresolved) {
      console.log(`  SKIP  provider=${r.csvRow.providerListingId}  name="${r.csvRow.internalName}"  reason=${r.unresolvedReason}`);
    }
  }

  console.log("\n--- Listings to insert ---");
  for (const r of plan.resolved) {
    const rooms = r.roomIds.length > 0 ? r.roomNames.join("+") : `UNRESOLVED(${r.unresolvedReason})`;
    console.log(
      `  ${r.csvRow.owner.padEnd(8)}  provider=${r.csvRow.providerListingId.padEnd(20)}  ` +
        `name="${r.csvRow.internalName}"  rooms=${rooms}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Apply: wipe + reload in a single transaction
// ---------------------------------------------------------------------------

async function applyWipeAndReload(plan: CheckPlan): Promise<ApplyTotals> {
  const totals: ApplyTotals = {
    refsCleared: 0,
    importRowsNulled: 0,
    listingsDeleted: 0,
    listingsInserted: 0,
    mappingsInserted: 0,
    unresolvedMappings: 0,
    errors: 0,
  };

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Null resolved_channel_listing_id (Restrict FK)
        const nulled = await tx.provider_reservation_import_rows.updateMany({
          where: { resolved_channel_listing_id: { not: null } },
          data: { resolved_channel_listing_id: null },
        });
        totals.importRowsNulled = nulled.count;

        // 2. Wipe reservation_external_refs (Restrict FK)
        const refsDeleted = await tx.reservation_external_refs.deleteMany({});
        totals.refsCleared = refsDeleted.count;

        // 3. Wipe channel_listings (cascades aliases + mappings)
        const listingsDeleted = await tx.channel_listings.deleteMany({});
        totals.listingsDeleted = listingsDeleted.count;

        // 4+5. Insert 59 listings + their room mappings
        for (const row of plan.resolved) {
          const listing = await tx.channel_listings.create({
            data: {
              external_account_id: plan.externalAccountId,
              provider_listing_id: row.csvRow.providerListingId,
              owner: row.csvRow.owner,
              title: row.csvRow.title,
              internal_name: row.csvRow.internalName,
              public_url: row.csvRow.url,
              status: "listed",
              listing_type: "home",
              source_metadata: row.csvRow.sourceMetadata as object,
            },
            select: { id: true },
          });
          totals.listingsInserted++;

          if (row.roomIds.length === 0) {
            totals.unresolvedMappings++;
            continue;
          }
          for (let i = 0; i < row.roomIds.length; i++) {
            await tx.listing_room_mappings.create({
              data: {
                channel_listing_id: listing.id,
                room_id: row.roomIds[i],
                mapping_role: "full_occupancy",
                sort_order: i + 1,
                notes: "",
              },
            });
            totals.mappingsInserted++;
          }
        }
      },
      { timeout: 60000 },
    );
  } catch (err) {
    console.error("Transaction failed:", err);
    totals.errors++;
  }

  return totals;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseOptions(process.argv.slice(2));
  console.log("=== seed-listings-sot.ts ===");
  console.log(
    `  Mode: ${opts.apply ? "APPLY" : "CHECK"}${opts.allowCrossBuilding ? " + ALLOW_CROSS_BUILDING" : ""}`,
  );
  console.log(`  Database: ${isAzureDatabase() ? "Azure" : "local"}`);

  if (opts.apply && isAzureDatabase() && process.env.JM_LISTINGS_SOT_AZURE_OK !== "1") {
    console.error("\nRefusing to apply against Azure without JM_LISTINGS_SOT_AZURE_OK=1.");
    process.exit(2);
  }

  const plan = await buildCheckPlan(opts);
  printCheckPlan(plan);

  if (!opts.apply) {
    const unresolved = plan.resolved.filter((r) => r.unresolvedReason).length;
    if (unresolved > 0) {
      console.log(`\nCHECK: ${unresolved} unresolved mappings. Investigate before applying.`);
    } else {
      console.log(`\nCHECK: all ${plan.mergedRows.length} rows resolve cleanly. Run --apply to proceed.`);
    }
    return;
  }

  console.log("\nApplying wipe-and-reload...");
  const totals = await applyWipeAndReload(plan);

  console.log("\n=== Apply complete ===");
  console.log(`  import_rows nulled:     ${totals.importRowsNulled}`);
  console.log(`  reservation_refs wiped: ${totals.refsCleared}`);
  console.log(`  listings deleted:       ${totals.listingsDeleted}`);
  console.log(`  listings inserted:      ${totals.listingsInserted}`);
  console.log(`  mappings inserted:      ${totals.mappingsInserted}`);
  console.log(`  unresolved mappings:    ${totals.unresolvedMappings}`);
  console.log(
    `\nSummary: deletes=${totals.listingsDeleted} inserts=${totals.listingsInserted} mappings=${totals.mappingsInserted} errors=${totals.errors}`,
  );

  if (totals.errors > 0) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error("seed-listings-sot failed:", err);
    process.exitCode = 1;
    return prisma.$disconnect();
  });