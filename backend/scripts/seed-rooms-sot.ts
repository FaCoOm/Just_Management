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

function parseOptions(argv: string[]): RunOptions {
  const apply = argv.includes("--apply");
  const check = argv.includes("--check") || !apply;
  return { apply, check };
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

async function main(): Promise<void> {
  const opts = parseOptions(process.argv.slice(2));
  console.log("Rooms Source-of-Truth seed");
  console.log(`  Mode: ${opts.apply ? "APPLY" : "CHECK"}`);
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

  if (opts.apply) {
    console.log("\nApplied. Verifying post-state...");
  } else {
    console.log("\nCHECK mode complete. Re-run with --apply to write changes.");
    if (totalCreate + totalUpdate > 0) {
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
