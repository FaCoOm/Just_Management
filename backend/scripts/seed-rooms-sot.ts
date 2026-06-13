/**
 * Rooms Source-of-Truth seed.
 *
 * Idempotent. Reads `backend/src/lib/rooms-source-of-truth.ts` and brings
 * the database into alignment with the 45-room canonical inventory.
 *
 * SAFETY MODEL:
 * - Default mode (`--apply`) only upserts SoT properties + rooms; never
 *   deletes anything. Legacy non-SoT properties remain in the database
 *   until explicitly archived in a future migration.
 * - `--check` runs a read-only verification and exits non-zero if the DB
 *   does not match the SoT.
 * - Refuses to mutate Azure-hosted databases unless the env-var
 *   `JM_ROOMS_SOT_AZURE_OK=1` is set. This is an explicit kill-switch the
 *   user must opt into for production runs.
 *
 * Run:
 *   npm --prefix backend run seed:rooms-sot          # equivalent to --check
 *   npm --prefix backend run seed:rooms-sot -- --apply
 *   JM_ROOMS_SOT_AZURE_OK=1 npm --prefix backend run seed:rooms-sot -- --apply  # production
 */

import process from "node:process";
import { PrismaClient } from "@prisma/client";
import {
  ROOMS_SOT_TOTAL,
  ROOMS_SOURCE_OF_TRUTH,
  resolveRoomType,
  type SoTProperty,
  type SoTRoom,
} from "../src/lib/rooms-source-of-truth";

const prisma = new PrismaClient();

interface RunOptions {
  apply: boolean;
  check: boolean;
  strictMode: boolean;
}

interface PropertyDelta {
  slug: string;
  before: { id: string; name: string; total_rooms: number } | null;
  after: { name: string; total_rooms: number };
  action: "create" | "update" | "noop";
}

interface RoomDelta {
  propertySlug: string;
  roomNumber: string;
  before: { id: string; room_name: string; room_type: string } | null;
  after: { room_name: string; room_type: string };
  action: "create" | "update" | "noop";
}

interface StrictDeletionProperty {
  id: string;
  slug: string;
  name: string;
}

interface StrictDeletionRoom {
  id: string;
  property_id: string;
  property_slug: string;
  room_number: string;
}

interface StrictDeletionPlan {
  propertiesToDelete: StrictDeletionProperty[];
  roomsToDelete: StrictDeletionRoom[];
}

type StrictDeletionBlockerTable =
  | "listing_room_mappings"
  | "reservation_room_allocations"
  | "maintenance_issues"
  | "guest_requests"
  | "guests"
  | "reservations.primary_room_id";

interface StrictDeletionBlocker {
  table: StrictDeletionBlockerTable;
  count: number;
}

interface StrictDeletionPreflight {
  blocked: boolean;
  blockers: StrictDeletionBlocker[];
}

function parseOptions(argv: string[]): RunOptions {
  const apply = argv.includes("--apply");
  const check = argv.includes("--check") || !apply;
  const strictMode = argv.includes("--strict");
  return { apply, check, strictMode };
}

function isAzureDatabase(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.includes("postgres.database.azure.com");
}

function buildRoomName(sotRoom: SoTRoom): string {
  const type = resolveRoomType(sotRoom.code);
  return `${type.title} \u2014 ${sotRoom.roomName}`;
}

async function planPropertyDeltas(): Promise<PropertyDelta[]> {
  const slugs = ROOMS_SOURCE_OF_TRUTH.map((p) => p.slug);
  const existing = await prisma.properties.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, name: true, total_rooms: true },
  });
  const bySlug = new Map(existing.map((p) => [p.slug, p]));
  return ROOMS_SOURCE_OF_TRUTH.map((sot) => {
    const before = bySlug.get(sot.slug) ?? null;
    const after = { name: sot.name, total_rooms: sot.rooms.length };
    let action: PropertyDelta["action"] = "create";
    if (before) {
      const matches = before.name === after.name && before.total_rooms === after.total_rooms;
      action = matches ? "noop" : "update";
    }
    return {
      slug: sot.slug,
      before: before ? { id: before.id, name: before.name, total_rooms: before.total_rooms } : null,
      after,
      action,
    };
  });
}

async function applyProperty(sot: SoTProperty): Promise<{ id: string }> {
  const result = await prisma.properties.upsert({
    where: { slug: sot.slug },
    update: { name: sot.name, total_rooms: sot.rooms.length },
    create: {
      slug: sot.slug,
      name: sot.name,
      total_rooms: sot.rooms.length,
      status: "active",
    },
    select: { id: true },
  });
  return result;
}

async function planRoomDeltasForProperty(propertyId: string, sot: SoTProperty): Promise<RoomDelta[]> {
  const existing = await prisma.rooms.findMany({
    where: { property_id: propertyId },
    select: { id: true, room_number: true, room_name: true, room_type: true },
  });
  const byNumber = new Map(existing.map((r) => [r.room_number, r]));
  return sot.rooms.map((sotRoom) => {
    const type = resolveRoomType(sotRoom.code);
    const before = byNumber.get(sotRoom.roomName) ?? null;
    const after = { room_name: buildRoomName(sotRoom), room_type: type.title };
    let action: RoomDelta["action"] = "create";
    if (before) {
      const matches = before.room_name === after.room_name && before.room_type === after.room_type;
      action = matches ? "noop" : "update";
    }
    return {
      propertySlug: sot.slug,
      roomNumber: sotRoom.roomName,
      before: before ? { id: before.id, room_name: before.room_name, room_type: before.room_type } : null,
      after,
      action,
    };
  });
}

async function applyRoom(propertyId: string, sotRoom: SoTRoom): Promise<void> {
  const type = resolveRoomType(sotRoom.code);
  const existing = await prisma.rooms.findFirst({
    where: { property_id: propertyId, room_number: sotRoom.roomName },
    select: { id: true },
  });
  if (existing) {
    await prisma.rooms.update({
      where: { id: existing.id },
      data: {
        room_name: buildRoomName(sotRoom),
        room_type: type.title,
      },
    });
  } else {
    await prisma.rooms.create({
      data: {
        property_id: propertyId,
        room_number: sotRoom.roomName,
        room_name: buildRoomName(sotRoom),
        room_type: type.title,
        status: "Vacant",
        floor: 1,
        passcode: "",
      },
    });
  }
}

async function planStrictDeletions(): Promise<StrictDeletionPlan> {
  const sotSlugs = new Set(ROOMS_SOURCE_OF_TRUTH.map((property) => property.slug));
  const sotRoomNumbersBySlug = new Map(
    ROOMS_SOURCE_OF_TRUTH.map((property) => [
      property.slug,
      new Set(property.rooms.map((room) => room.roomName)),
    ]),
  );

  const [propertiesToDelete, existingSoTProperties, existingRoomsInSoTProperties] = await Promise.all([
    prisma.properties.findMany({
      where: { slug: { notIn: Array.from(sotSlugs) } },
      select: { id: true, slug: true, name: true },
      orderBy: { slug: "asc" },
    }),
    prisma.properties.findMany({
      where: { slug: { in: Array.from(sotSlugs) } },
      select: { id: true, slug: true },
    }),
    prisma.rooms.findMany({
      where: { property: { slug: { in: Array.from(sotSlugs) } } },
      select: {
        id: true,
        property_id: true,
        room_number: true,
        property: { select: { slug: true } },
      },
      orderBy: [{ property_id: "asc" }, { room_number: "asc" }],
    }),
  ]);

  const existingSoTPropertyIds = new Set(existingSoTProperties.map((property) => property.id));
  const roomsToDelete = existingRoomsInSoTProperties
    .filter((room) => existingSoTPropertyIds.has(room.property_id))
    .filter((room) => {
      const allowedRoomNumbers = sotRoomNumbersBySlug.get(room.property.slug);
      return !allowedRoomNumbers?.has(room.room_number);
    })
    .map((room) => ({
      id: room.id,
      property_id: room.property_id,
      property_slug: room.property.slug,
      room_number: room.room_number,
    }));

  return { propertiesToDelete, roomsToDelete };
}

async function preflightStrictDeletions(plan: StrictDeletionPlan): Promise<StrictDeletionPreflight> {
  if (plan.roomsToDelete.length === 0) {
    return { blocked: false, blockers: [] };
  }

  const roomIds = plan.roomsToDelete.map((room) => room.id);
  const [listingRoomMappings, reservationRoomAllocations, maintenanceIssues, guestRequests, guests, reservations] =
    await Promise.all([
      prisma.listing_room_mappings.count({ where: { room_id: { in: roomIds } } }),
      prisma.reservation_room_allocations.count({ where: { room_id: { in: roomIds } } }),
      prisma.maintenance_issues.count({ where: { room_id: { in: roomIds } } }),
      prisma.guest_requests.count({ where: { room_id: { in: roomIds } } }),
      prisma.guests.count({ where: { room_id: { in: roomIds } } }),
      prisma.reservations.count({ where: { primary_room_id: { in: roomIds } } }),
    ]);

  const blockers = [
    { table: "listing_room_mappings", count: listingRoomMappings },
    { table: "reservation_room_allocations", count: reservationRoomAllocations },
    { table: "maintenance_issues", count: maintenanceIssues },
    { table: "guest_requests", count: guestRequests },
    { table: "guests", count: guests },
    { table: "reservations.primary_room_id", count: reservations },
  ] satisfies StrictDeletionBlocker[];

  return {
    blocked: blockers.some((blocker) => blocker.count > 0),
    blockers: blockers.filter((blocker) => blocker.count > 0),
  };
}

function printPropertyPlan(deltas: PropertyDelta[]): void {
  console.log("\n=== Property plan ===");
  for (const d of deltas) {
    if (d.action === "create") {
      console.log(`  CREATE  ${d.slug.padEnd(8)}  name="${d.after.name}"  total_rooms=${d.after.total_rooms}`);
    } else if (d.action === "update") {
      console.log(
        `  UPDATE  ${d.slug.padEnd(8)}  ` +
          `name="${d.before?.name}" -> "${d.after.name}"  ` +
          `total_rooms=${d.before?.total_rooms} -> ${d.after.total_rooms}`,
      );
    } else {
      console.log(`  ok      ${d.slug.padEnd(8)}  name="${d.after.name}"  total_rooms=${d.after.total_rooms}`);
    }
  }
}

function printRoomPlan(slug: string, deltas: RoomDelta[]): void {
  const counts = { create: 0, update: 0, noop: 0 };
  for (const d of deltas) {
    counts[d.action]++;
  }
  console.log(
    `  [${slug}] ${deltas.length} rooms (create=${counts.create} update=${counts.update} ok=${counts.noop})`,
  );
  for (const d of deltas) {
    if (d.action === "create") {
      console.log(
        `      CREATE  number="${d.roomNumber}"  type="${d.after.room_type}"  name="${d.after.room_name}"`,
      );
    } else if (d.action === "update") {
      console.log(
        `      UPDATE  number="${d.roomNumber}"  ` +
          `type="${d.before?.room_type}" -> "${d.after.room_type}"  ` +
          `name="${d.before?.room_name}" -> "${d.after.room_name}"`,
      );
    }
  }
}

function printStrictDeletionPlan(plan: StrictDeletionPlan, apply: boolean): void {
  console.log("\n=== Strict deletion plan ===");
  console.log(`  Properties to delete: ${plan.propertiesToDelete.length}`);
  for (const property of plan.propertiesToDelete) {
    console.log(`      DELETE  property slug="${property.slug}"  name="${property.name}"  id=${property.id}`);
  }

  console.log(`  Rooms to delete: ${plan.roomsToDelete.length}`);
  for (const room of plan.roomsToDelete) {
    console.log(
      `      DELETE  room property="${room.property_slug}"  number="${room.room_number}"  id=${room.id}`,
    );
  }

  if (!apply) {
    console.log("  Strict mode check-only: deletion plan printed, no mutations will run.");
  }
}

function printStrictPreflight(preflight: StrictDeletionPreflight): void {
  console.log("\n=== Strict deletion FK pre-flight ===");
  if (!preflight.blocked) {
    console.log("  OK      no blocking room references found.");
    return;
  }

  for (const blocker of preflight.blockers) {
    console.log(`  BLOCK   ${blocker.table}=${blocker.count}`);
  }
}

async function main(): Promise<void> {
  const opts = parseOptions(process.argv.slice(2));
  console.log("Rooms Source-of-Truth seed");
  console.log(`  Mode: ${opts.apply ? "APPLY" : "CHECK"}${opts.strictMode ? " + STRICT" : ""}`);
  console.log(`  Total rooms expected: ${ROOMS_SOT_TOTAL}`);
  console.log(`  Properties: ${ROOMS_SOURCE_OF_TRUTH.length}`);

  if (opts.apply && isAzureDatabase() && process.env.JM_ROOMS_SOT_AZURE_OK !== "1") {
    console.error(
      "\nRefusing to apply against Azure DATABASE_URL without JM_ROOMS_SOT_AZURE_OK=1.",
    );
    process.exit(2);
  }

  const propertyPlan = await planPropertyDeltas();
  printPropertyPlan(propertyPlan);

  if (opts.apply) {
    for (const sot of ROOMS_SOURCE_OF_TRUTH) {
      await applyProperty(sot);
    }
  }

  console.log("\n=== Room plan per property ===");
  let totalCreate = 0;
  let totalUpdate = 0;
  let totalNoop = 0;
  for (const sot of ROOMS_SOURCE_OF_TRUTH) {
    const property = await prisma.properties.findUnique({ where: { slug: sot.slug } });
    if (!property) {
      console.log(`  [${sot.slug}] PENDING property creation; skipping room plan in CHECK mode`);
      continue;
    }
    const roomDeltas = await planRoomDeltasForProperty(property.id, sot);
    printRoomPlan(sot.slug, roomDeltas);
    totalCreate += roomDeltas.filter((r) => r.action === "create").length;
    totalUpdate += roomDeltas.filter((r) => r.action === "update").length;
    totalNoop += roomDeltas.filter((r) => r.action === "noop").length;

    if (opts.apply) {
      for (const sotRoom of sot.rooms) {
        await applyRoom(property.id, sotRoom);
      }
    }
  }

  console.log(`\nRoom plan totals: create=${totalCreate} update=${totalUpdate} ok=${totalNoop}`);

  let strictDeletionPlan: StrictDeletionPlan | null = null;
  let strictPreflight: StrictDeletionPreflight | null = null;
  if (opts.strictMode) {
    strictDeletionPlan = await planStrictDeletions();
    printStrictDeletionPlan(strictDeletionPlan, opts.apply);

    strictPreflight = await preflightStrictDeletions(strictDeletionPlan);
    printStrictPreflight(strictPreflight);
  }

  if (opts.apply) {
    if (opts.strictMode && strictDeletionPlan && strictPreflight) {
      if (strictPreflight.blocked) {
        console.error(
          `\nStrict delete blocked: ${strictPreflight.blockers
            .map((blocker) => `${blocker.table}=${blocker.count}`)
            .join(", ")}. Clear those references before retrying with --apply --strict.`,
        );
        process.exit(1);
      }

      await prisma.$transaction([
        prisma.rooms.deleteMany({ where: { id: { in: strictDeletionPlan.roomsToDelete.map((room) => room.id) } } }),
        prisma.properties.deleteMany({
          where: { id: { in: strictDeletionPlan.propertiesToDelete.map((property) => property.id) } },
        }),
      ]);
    }

    console.log("\nApplied. Verifying post-state...");
  } else {
    console.log("\nCHECK mode complete. Re-run with --apply to write changes.");
    if (
      totalCreate + totalUpdate > 0 ||
      (strictDeletionPlan !== null &&
        (strictDeletionPlan.propertiesToDelete.length > 0 || strictDeletionPlan.roomsToDelete.length > 0))
    ) {
      console.log("Drift detected: DB does not match SoT.");
      process.exitCode = 1;
    }
  }

  if (opts.apply) {
    let actualTotal = 0;
    for (const sot of ROOMS_SOURCE_OF_TRUTH) {
      const property = await prisma.properties.findUnique({ where: { slug: sot.slug } });
      if (!property) {
        console.error(`  MISSING property after apply: ${sot.slug}`);
        process.exitCode = 1;
        continue;
      }
      const count = await prisma.rooms.count({ where: { property_id: property.id } });
      if (count !== sot.rooms.length) {
        console.error(
          `  ${sot.slug}: expected ${sot.rooms.length} rooms, found ${count} (excess rows from legacy ingestion not touched)`,
        );
      }
      actualTotal += sot.rooms.length;
    }
    console.log(`\nSoT inventory size: ${actualTotal} rooms across ${ROOMS_SOURCE_OF_TRUTH.length} properties.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error("seed-rooms-sot failed:", err);
    process.exitCode = 1;
    return prisma.$disconnect();
  });
