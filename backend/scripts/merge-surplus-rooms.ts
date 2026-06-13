/**
 * Merge surplus rooms inside SoT properties.
 *
 * Default mode is `--check`, which is read-only and prints the merge/delete
 * plan for the known surplus rooms.
 *
 * Apply mode rewrites FK references room-by-room, then deletes each surplus
 * room. Azure mutations require `JM_ROOMS_SOT_AZURE_OK=1`.
 *
 * Run:
 *   npm --prefix backend run merge:surplus-rooms          # equivalent to --check
 *   npm --prefix backend run merge:surplus-rooms -- --check
 *   JM_ROOMS_SOT_AZURE_OK=1 npm --prefix backend run merge:surplus-rooms -- --apply
 */

import process from "node:process";
import { Prisma, PrismaClient } from "@prisma/client";
import { findPropertyBySlug } from "../src/lib/rooms-source-of-truth";

const prisma = new PrismaClient();

interface RunOptions {
  apply: boolean;
  check: boolean;
}

interface RoomReferenceSummary {
  listingRoomMappings: number;
  reservationRoomAllocations: number;
  reservationPrimaryRoomRefs: number;
  guestRefs: number;
  guestRequestRefs: number;
  maintenanceIssueRefs: number;
}

interface PropertyRow {
  id: string;
  slug: string;
  name: string;
}

interface RoomRow {
  id: string;
  property_id: string;
  room_number: string;
  property: { slug: string };
}

interface MergeRoomSpec {
  kind: "merge";
  surplusPropertySlug: string;
  surplusRoomNumber: string;
  canonicalPropertySlug: string;
  canonicalRoomNumber: string;
}

interface DeleteOnlyRoomSpec {
  kind: "delete-only";
  surplusPropertySlug: string;
  surplusRoomNumber: string;
}

type SurplusRoomSpec = MergeRoomSpec | DeleteOnlyRoomSpec;

interface PlannedRoomMutationBase {
  spec: SurplusRoomSpec;
  surplusProperty: PropertyRow;
  surplusRoom: RoomRow;
  references: RoomReferenceSummary;
}

interface PlannedMergeRoomMutation extends PlannedRoomMutationBase {
  spec: MergeRoomSpec;
  canonicalProperty: PropertyRow;
  canonicalRoom: RoomRow;
}

interface PlannedDeleteOnlyRoomMutation extends PlannedRoomMutationBase {
  spec: DeleteOnlyRoomSpec;
}

type PlannedRoomMutation = PlannedMergeRoomMutation | PlannedDeleteOnlyRoomMutation;

interface CountedReference {
  table: string;
  count: number;
}

const SURPLUS_ROOM_SPECS: SurplusRoomSpec[] = [
  {
    kind: "merge",
    surplusPropertySlug: "tc",
    surplusRoomNumber: "8.05",
    canonicalPropertySlug: "tc",
    canonicalRoomNumber: "C 8.05",
  },
  {
    kind: "merge",
    surplusPropertySlug: "tc",
    surplusRoomNumber: "C12.02",
    canonicalPropertySlug: "tc",
    canonicalRoomNumber: "C 12.02",
  },
  {
    kind: "merge",
    surplusPropertySlug: "ll",
    surplusRoomNumber: "coffee 3",
    canonicalPropertySlug: "ll",
    canonicalRoomNumber: "Coffee 3",
  },
  {
    kind: "merge",
    surplusPropertySlug: "ll",
    surplusRoomNumber: "Latte 1",
    canonicalPropertySlug: "ll",
    canonicalRoomNumber: "Latte",
  },
  {
    kind: "merge",
    surplusPropertySlug: "theo",
    surplusRoomNumber: "B20.12A Main",
    canonicalPropertySlug: "theo",
    canonicalRoomNumber: "B20.12A",
  },
  {
    kind: "merge",
    surplusPropertySlug: "cc",
    surplusRoomNumber: "303 (301 cÅ©)",
    canonicalPropertySlug: "cc",
    canonicalRoomNumber: "303",
  },
  {
    kind: "merge",
    surplusPropertySlug: "cc",
    surplusRoomNumber: "303 (301 cu)",
    canonicalPropertySlug: "cc",
    canonicalRoomNumber: "303",
  },
  {
    kind: "merge",
    surplusPropertySlug: "ta",
    surplusRoomNumber: "The Alley 1",
    canonicalPropertySlug: "ta",
    canonicalRoomNumber: "Alley 1",
  },
  {
    kind: "delete-only",
    surplusPropertySlug: "ll",
    surplusRoomNumber: "C2-M2",
  },
];

function parseOptions(argv: string[]): RunOptions {
  const apply = argv.includes("--apply");
  const check = argv.includes("--check") || !apply;
  return { apply, check };
}

function isAzureDatabase(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.includes("postgres.database.azure.com");
}

function roomKey(propertySlug: string, roomNumber: string): string {
  return `${propertySlug}::${roomNumber}`;
}

function isMergePlanEntry(entry: PlannedRoomMutation): entry is PlannedMergeRoomMutation {
  return entry.spec.kind === "merge";
}

function isDeleteOnlyPlanEntry(entry: PlannedRoomMutation): entry is PlannedDeleteOnlyRoomMutation {
  return entry.spec.kind === "delete-only";
}

function collectUnexpectedRoomReferences(references: RoomReferenceSummary): CountedReference[] {
  return [
    { table: "guests", count: references.guestRefs },
    { table: "guest_requests", count: references.guestRequestRefs },
    { table: "maintenance_issues", count: references.maintenanceIssueRefs },
  ].filter((entry) => entry.count > 0);
}

function validateSpecsAgainstSoT(): void {
  for (const spec of SURPLUS_ROOM_SPECS) {
    const surplusProperty = findPropertyBySlug(spec.surplusPropertySlug);
    if (!surplusProperty) {
      throw new Error(`Unknown surplus property slug in merge script: ${spec.surplusPropertySlug}`);
    }

    if (spec.kind === "merge") {
      const canonicalProperty = findPropertyBySlug(spec.canonicalPropertySlug);
      if (!canonicalProperty) {
        throw new Error(`Unknown canonical property slug in merge script: ${spec.canonicalPropertySlug}`);
      }

      const canonicalRoomExists = canonicalProperty.rooms.some(
        (room) => room.roomName === spec.canonicalRoomNumber,
      );
      if (!canonicalRoomExists) {
        throw new Error(
          `Canonical room not present in SoT: ${spec.canonicalPropertySlug} / "${spec.canonicalRoomNumber}"`,
        );
      }
    }
  }
}

async function countRoomReferences(roomId: string): Promise<RoomReferenceSummary> {
  const [
    listingRoomMappings,
    reservationRoomAllocations,
    reservationPrimaryRoomRefs,
    guestRefs,
    guestRequestRefs,
    maintenanceIssueRefs,
  ] = await prisma.$transaction([
    prisma.listing_room_mappings.count({ where: { room_id: roomId } }),
    prisma.reservation_room_allocations.count({ where: { room_id: roomId } }),
    prisma.reservations.count({ where: { primary_room_id: roomId } }),
    prisma.guests.count({ where: { room_id: roomId } }),
    prisma.guest_requests.count({ where: { room_id: roomId } }),
    prisma.maintenance_issues.count({ where: { room_id: roomId } }),
  ]);

  return {
    listingRoomMappings,
    reservationRoomAllocations,
    reservationPrimaryRoomRefs,
    guestRefs,
    guestRequestRefs,
    maintenanceIssueRefs,
  };
}

function expectProperty(propertiesBySlug: Map<string, PropertyRow>, slug: string): PropertyRow {
  const property = propertiesBySlug.get(slug);
  if (!property) {
    throw new Error(`Property not found in DB: ${slug}`);
  }
  return property;
}

function expectSingleRoom(roomsByKey: Map<string, RoomRow[]>, propertySlug: string, roomNumber: string): RoomRow {
  const matches = roomsByKey.get(roomKey(propertySlug, roomNumber)) ?? [];
  if (matches.length === 0) {
    throw new Error(`Room not found in DB: ${propertySlug} / "${roomNumber}"`);
  }
  if (matches.length > 1) {
    throw new Error(`Room lookup ambiguous in DB: ${propertySlug} / "${roomNumber}" (${matches.length} rows)`);
  }
  return matches[0];
}

async function buildPlan(): Promise<PlannedRoomMutation[]> {
  const propertySlugs = Array.from(
    new Set(
      SURPLUS_ROOM_SPECS.flatMap((spec) =>
        spec.kind === "merge"
          ? [spec.surplusPropertySlug, spec.canonicalPropertySlug]
          : [spec.surplusPropertySlug],
      ),
    ),
  );

  const [properties, rooms] = await Promise.all([
    prisma.properties.findMany({
      where: { slug: { in: propertySlugs } },
      select: { id: true, slug: true, name: true },
    }),
    prisma.rooms.findMany({
      where: { property: { slug: { in: propertySlugs } } },
      select: {
        id: true,
        property_id: true,
        room_number: true,
        property: { select: { slug: true } },
      },
    }),
  ]);

  const propertiesBySlug = new Map(properties.map((property) => [property.slug, property]));
  const roomsByKey = new Map<string, RoomRow[]>();
  for (const room of rooms) {
    const key = roomKey(room.property.slug, room.room_number);
    const existing = roomsByKey.get(key) ?? [];
    existing.push(room);
    roomsByKey.set(key, existing);
  }

  const plan: PlannedRoomMutation[] = [];

  for (const spec of SURPLUS_ROOM_SPECS) {
    const surplusProperty = expectProperty(propertiesBySlug, spec.surplusPropertySlug);
    const surplusKey = roomKey(spec.surplusPropertySlug, spec.surplusRoomNumber);
    const surplusMatches = roomsByKey.get(surplusKey) ?? [];
    if (surplusMatches.length === 0) {
      console.log(`  [SKIP]  Surplus room ${spec.surplusPropertySlug} / "${spec.surplusRoomNumber}" not found in DB; skipping.`);
      continue;
    }
    const surplusRoom = surplusMatches[0];
    const references = await countRoomReferences(surplusRoom.id);

    if (spec.kind === "delete-only") {
      plan.push({
        spec,
        surplusProperty,
        surplusRoom,
        references,
      });
      continue;
    }

    const canonicalProperty = expectProperty(propertiesBySlug, spec.canonicalPropertySlug);
    const canonicalRoom = expectSingleRoom(roomsByKey, spec.canonicalPropertySlug, spec.canonicalRoomNumber);

    if (canonicalRoom.id === surplusRoom.id) {
      throw new Error(
        `Canonical room resolves to same row as surplus room: ${spec.surplusPropertySlug} / "${spec.surplusRoomNumber}"`,
      );
    }

    plan.push({
      spec,
      surplusProperty,
      surplusRoom,
      canonicalProperty,
      canonicalRoom,
      references,
    });
  }

  return plan;
}

function printPlan(plan: PlannedRoomMutation[], opts: RunOptions): void {
  const mergeCount = plan.filter(isMergePlanEntry).length;
  const deleteOnlyCount = plan.length - mergeCount;

  console.log("Merge surplus rooms");
  console.log(`  Mode: ${opts.apply ? "APPLY" : "CHECK"}`);
  console.log(`  Configured surplus rooms: ${SURPLUS_ROOM_SPECS.length}`);
  console.log(`  Planned surplus rooms: ${plan.length}`);
  console.log(`  Merge targets: ${mergeCount}`);
  console.log(`  Delete-only targets: ${deleteOnlyCount}`);
  console.log("\n=== Planned room actions ===");

  for (const entry of plan) {
    if (isMergePlanEntry(entry)) {
      console.log(
        `  MERGE   ${entry.spec.surplusPropertySlug} / "${entry.spec.surplusRoomNumber}"  id=${entry.surplusRoom.id}` +
          `  ->  ${entry.spec.canonicalPropertySlug} / "${entry.spec.canonicalRoomNumber}"  id=${entry.canonicalRoom.id}`,
      );
    } else {
      console.log(
        `  DELETE  ${entry.spec.surplusPropertySlug} / "${entry.spec.surplusRoomNumber}"  id=${entry.surplusRoom.id}` +
          "  (delete-only composite; mappings/allocations dropped)",
      );
    }

    console.log(
      `          refs  listing_room_mappings=${entry.references.listingRoomMappings}` +
        `  reservation_room_allocations=${entry.references.reservationRoomAllocations}` +
        `  reservations.primary_room_id=${entry.references.reservationPrimaryRoomRefs}`,
    );

    const unexpectedRefParts = collectUnexpectedRoomReferences(entry.references);

    if (unexpectedRefParts.length > 0) {
      console.log(
        `          BLOCK unexpected refs: ${unexpectedRefParts
          .map((part) => `${part.table}=${part.count}`)
          .join(" ")}`,
      );
    }

    if (isDeleteOnlyPlanEntry(entry) && entry.references.reservationPrimaryRoomRefs > 0) {
      console.log(
        '          BLOCK delete-only special case: reservations.primary_room_id must be 0 before deleting ll / "C2-M2"',
      );
    }
  }
}

function assertPlanIsSafe(plan: PlannedRoomMutation[]): void {
  for (const entry of plan) {
    const unexpectedBlockers = collectUnexpectedRoomReferences(entry.references);

    if (unexpectedBlockers.length > 0) {
      throw new Error(
        `Refusing to mutate ${entry.spec.surplusPropertySlug} / "${entry.spec.surplusRoomNumber}": ` +
          unexpectedBlockers.map((blocker) => `${blocker.table}=${blocker.count}`).join(", "),
      );
    }

    if (isDeleteOnlyPlanEntry(entry) && entry.references.reservationPrimaryRoomRefs > 0) {
      throw new Error(
        `Refusing to delete-only ${entry.spec.surplusPropertySlug} / "${entry.spec.surplusRoomNumber}": ` +
          `reservations.primary_room_id=${entry.references.reservationPrimaryRoomRefs}. ` +
          "Manually re-allocate those reservations first.",
      );
    }
  }
}

async function reassignListingRoomMappings(
  tx: Prisma.TransactionClient,
  surplusRoomId: string,
  canonicalRoomId: string,
): Promise<void> {
  const mappings = await tx.listing_room_mappings.findMany({
    where: { room_id: surplusRoomId },
    select: { id: true, channel_listing_id: true },
    orderBy: { created_at: "asc" },
  });

  for (const mapping of mappings) {
    const canonicalMapping = await tx.listing_room_mappings.findFirst({
      where: {
        channel_listing_id: mapping.channel_listing_id,
        room_id: canonicalRoomId,
      },
      select: { id: true },
    });

    if (canonicalMapping) {
      await tx.listing_room_mappings.delete({ where: { id: mapping.id } });
    } else {
      await tx.listing_room_mappings.update({
        where: { id: mapping.id },
        data: { room_id: canonicalRoomId },
      });
    }
  }
}

async function reassignReservationRoomAllocations(
  tx: Prisma.TransactionClient,
  surplusRoomId: string,
  canonicalRoomId: string,
): Promise<void> {
  const allocations = await tx.reservation_room_allocations.findMany({
    where: { room_id: surplusRoomId },
    select: { id: true, reservation_id: true },
    orderBy: { created_at: "asc" },
  });

  for (const allocation of allocations) {
    const canonicalAllocation = await tx.reservation_room_allocations.findUnique({
      where: {
        reservation_id_room_id: {
          reservation_id: allocation.reservation_id,
          room_id: canonicalRoomId,
        },
      },
      select: { id: true },
    });

    if (canonicalAllocation) {
      await tx.reservation_room_allocations.delete({ where: { id: allocation.id } });
    } else {
      await tx.reservation_room_allocations.update({
        where: { id: allocation.id },
        data: { room_id: canonicalRoomId },
      });
    }
  }
}

async function applyMerge(tx: Prisma.TransactionClient, entry: PlannedMergeRoomMutation): Promise<void> {
  await reassignListingRoomMappings(tx, entry.surplusRoom.id, entry.canonicalRoom.id);
  await reassignReservationRoomAllocations(tx, entry.surplusRoom.id, entry.canonicalRoom.id);
  await tx.reservations.updateMany({
    where: { primary_room_id: entry.surplusRoom.id },
    data: { primary_room_id: entry.canonicalRoom.id },
  });
  await tx.rooms.delete({ where: { id: entry.surplusRoom.id } });
}

async function applyDeleteOnly(tx: Prisma.TransactionClient, entry: PlannedDeleteOnlyRoomMutation): Promise<void> {
  const primaryRefs = await tx.reservations.count({
    where: { primary_room_id: entry.surplusRoom.id },
  });

  if (primaryRefs > 0) {
    throw new Error(
      `Refusing to delete-only ${entry.spec.surplusPropertySlug} / "${entry.spec.surplusRoomNumber}": ` +
        `reservations.primary_room_id=${primaryRefs}. Manually re-allocate those reservations first.`,
    );
  }

  await tx.listing_room_mappings.deleteMany({ where: { room_id: entry.surplusRoom.id } });
  await tx.reservation_room_allocations.deleteMany({ where: { room_id: entry.surplusRoom.id } });
  await tx.rooms.delete({ where: { id: entry.surplusRoom.id } });
}

async function applyPlan(plan: PlannedRoomMutation[]): Promise<void> {
  for (const entry of plan) {
    await prisma.$transaction(async (tx) => {
      if (isMergePlanEntry(entry)) {
        await applyMerge(tx, entry);
      } else {
        await applyDeleteOnly(tx, entry);
      }
    });
  }
}

async function main(): Promise<void> {
  validateSpecsAgainstSoT();

  const opts = parseOptions(process.argv.slice(2));
  if (opts.apply && isAzureDatabase() && process.env.JM_ROOMS_SOT_AZURE_OK !== "1") {
    console.error("\nRefusing to apply against Azure DATABASE_URL without JM_ROOMS_SOT_AZURE_OK=1.");
    process.exit(2);
  }

  const plan = await buildPlan();
  printPlan(plan, opts);

  if (!opts.apply) {
    console.log("\nCHECK mode complete. Re-run with --apply to execute the plan.");
    return;
  }

  assertPlanIsSafe(plan);
  await applyPlan(plan);
  console.log("\nApply complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((err: unknown) => {
    console.error("merge-surplus-rooms failed:", err);
    process.exitCode = 1;
    return prisma.$disconnect();
  });
