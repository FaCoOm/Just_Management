import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sampleTitles = [
  "MUJO- Deluxe condo @District1 #BenThanh",
  "MUJO - Comfortable bed room central city #Netflix",
  "Cochinchine Delxue flat at the city #Central",
  "Latte Lounge - Minimalist Haven just off Ben Thanh",
] as const;

type CountRow = { count: bigint };
type TitleRow = { title: string };
type DuplicateRow = { title: string; count: bigint };
type DeadLetterRow = {
  created_at: Date;
  failure_code: string;
  failure_reason: string;
  source_row_number: number | null;
  listing_alias_value: string | null;
  confirmation_code: string | null;
  raw_payload: unknown;
};

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function stringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_, innerValue) => {
      if (typeof innerValue === "bigint") {
        return innerValue.toString();
      }

      if (innerValue instanceof Date) {
        return innerValue.toISOString();
      }

      return innerValue;
    },
    2,
  );
}

function keywordForLike(title: string): string {
  const token = title
    .split(/[^A-Za-z0-9]+/)
    .find((part) => part.length >= 6);

  return token ?? title.slice(0, Math.min(title.length, 12)).trim();
}

async function main(): Promise<void> {
  section("exact title checks");

  for (const title of sampleTitles) {
    const exactMatches = await prisma.$queryRaw<TitleRow[]>`
      SELECT title
      FROM channel_listings
      WHERE title = ${title}
      ORDER BY title ASC
    `;

    if (exactMatches.length === 0) {
      console.log(`[not found] ${title}`);

      const keyword = keywordForLike(title);
      const approximateMatches = await prisma.$queryRaw<TitleRow[]>`
        SELECT title
        FROM channel_listings
        WHERE title ILIKE ${`%${keyword}%`}
        ORDER BY title ASC
        LIMIT 10
      `;

      console.log(`  keyword=${keyword}`);
      if (approximateMatches.length === 0) {
        console.log("  approx: (no matches)");
      } else {
        for (const match of approximateMatches) {
          console.log(`  approx: ${match.title}`);
        }
      }

      continue;
    }

    if (exactMatches.length === 1) {
      console.log(`[found] ${title}`);
      continue;
    }

    console.log(`[found-${exactMatches.length}-matches] ${title}`);
    for (const match of exactMatches) {
      console.log(`  exact: ${match.title}`);
    }
  }

  section("alias count");
  const [aliasCount] = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::bigint AS count
    FROM channel_listing_aliases
  `;
  console.log(`channel_listing_aliases.count=${aliasCount.count.toString()}`);

  section("duplicate channel_listings.title rows");
  const duplicates = await prisma.$queryRaw<DuplicateRow[]>`
    SELECT title, COUNT(*)::bigint AS count
    FROM channel_listings
    GROUP BY title
    HAVING COUNT(*) > 1
    ORDER BY count DESC, title ASC
  `;

  if (duplicates.length === 0) {
    console.log("(no duplicate titles)");
  } else {
    for (const row of duplicates) {
      console.log(`${row.count.toString()} x ${row.title}`);
    }
  }

  section("latest unresolved reservation evidence");
  const unresolvedRows = await prisma.$queryRaw<DeadLetterRow[]>`
    SELECT
      sdl.created_at,
      sdl.failure_code,
      sdl.failure_reason,
      sdl.source_row_number,
      prir.listing_alias_value,
      prir.confirmation_code,
      prir.raw_payload
    FROM sync_dead_letters sdl
    LEFT JOIN provider_reservation_import_rows prir
      ON prir.source_row_number = sdl.source_row_number
      AND prir.listing_alias_value IS NOT NULL
    WHERE sdl.failure_code = 'UNRESOLVED_LISTING'
    ORDER BY sdl.created_at DESC
    LIMIT 1
  `;

  if (unresolvedRows.length === 0) {
    console.log("(no unresolved dead-letter found)");
  } else {
    console.log(stringify(unresolvedRows[0]));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
