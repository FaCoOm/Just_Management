import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type PropertyCountRow = {
  count: bigint;
  slug: string;
  name: string;
};

type RoomsPerPropertyRow = {
  property_slug: string;
  room_count: bigint;
};

type CountRow = {
  count: bigint;
};

type SyncRunRow = {
  id: string;
  source_type: string;
  status: string;
  processed_count: number;
  dead_letter_count: number;
  finished_at: Date | null;
};

type DeadLetterRow = {
  failure_code: string;
  failure_reason: string;
  sync_run_id: string;
};

type ResolutionStatusRow = {
  resolution_status: string;
  count: bigint;
};

function printSection(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function formatValue(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === null) {
    return "null";
  }

  return String(value);
}

function printRows(rows: Array<Record<string, unknown>>): void {
  if (rows.length === 0) {
    console.log("(no rows)");
    return;
  }

  for (const row of rows) {
    console.log(JSON.stringify(row, (_, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      return value;
    }));
  }
}

function printCount(label: string, row: CountRow): void {
  console.log(`${label}: ${formatValue(row.count)}`);
}

async function main(): Promise<void> {
  printSection("properties grouped by slug/name");
  const properties = await prisma.$queryRaw<PropertyCountRow[]>`
    SELECT COUNT(*)::bigint AS count, slug, name
    FROM properties
    GROUP BY slug, name
    ORDER BY name ASC
  `;
  printRows(properties);

  printSection("rooms total");
  const [roomsTotal] = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::bigint AS count
    FROM rooms
  `;
  printCount("rooms", roomsTotal);

  printSection("rooms per property_slug");
  const roomsPerProperty = await prisma.$queryRaw<RoomsPerPropertyRow[]>`
    SELECT p.slug AS property_slug, COUNT(r.id)::bigint AS room_count
    FROM properties p
    LEFT JOIN rooms r ON r.property_id = p.id
    GROUP BY p.slug
    ORDER BY p.slug ASC
  `;
  printRows(roomsPerProperty);

  printSection("table counts");
  const [reservationsCount, channelListingsCount, listingRoomMappingsCount, channelListingAliasesCount] =
    await Promise.all([
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS count
        FROM reservations
      `,
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS count
        FROM channel_listings
      `,
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS count
        FROM listing_room_mappings
      `,
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS count
        FROM channel_listing_aliases
      `,
    ]);
  printCount("reservations", reservationsCount[0]);
  printCount("channel_listings", channelListingsCount[0]);
  printCount("listing_room_mappings", listingRoomMappingsCount[0]);
  printCount("channel_listing_aliases", channelListingAliasesCount[0]);

  printSection("recent sync_runs");
  const syncRuns = await prisma.$queryRaw<SyncRunRow[]>`
    SELECT id, source_type, status, processed_count, dead_letter_count, finished_at
    FROM sync_runs
    ORDER BY COALESCE(finished_at, started_at) DESC, started_at DESC
    LIMIT 5
  `;
  printRows(syncRuns);

  printSection("recent sync_dead_letters");
  const deadLetters = await prisma.$queryRaw<DeadLetterRow[]>`
    SELECT
      failure_code,
      CASE
        WHEN LENGTH(failure_reason) > 160 THEN LEFT(failure_reason, 160) || '...'
        ELSE failure_reason
      END AS failure_reason,
      sync_run_id
    FROM sync_dead_letters
    ORDER BY created_at DESC
    LIMIT 10
  `;
  printRows(deadLetters);

  printSection("provider_reservation_import_rows by resolution_status");
  const reservationImportRows = await prisma.$queryRaw<ResolutionStatusRow[]>`
    SELECT resolution_status, COUNT(*)::bigint AS count
    FROM provider_reservation_import_rows
    GROUP BY resolution_status
    ORDER BY resolution_status ASC
  `;
  printRows(reservationImportRows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
