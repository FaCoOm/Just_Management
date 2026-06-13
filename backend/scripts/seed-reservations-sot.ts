/**
 * Ingestion pipeline script to seed/re-import reservations from docs/database_design/reservations.csv.
 * Use --apply to execute the database mutations.
 * 
 * Run:
 *   npm --prefix backend run seed:reservations-sot
 *   npm --prefix backend run seed:reservations-sot -- --apply
 */

import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { processReservationSync } from "../src/ingest/services/reservations";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const isDryRun = !apply;

  console.log("=== seed-reservations-sot ===");
  console.log(`  Mode: ${apply ? "APPLY" : "CHECK (Dry Run)"}`);

  const filePath = path.resolve(__dirname, "..", "..", "docs", "database_design", "reservations.csv");
  if (!fs.existsSync(filePath)) {
    console.error(`Error: reservations.csv not found at ${filePath}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  const summary = await processReservationSync(
    buffer,
    "text/csv",
    "airbnb-main",
    isDryRun,
    "reservations.csv",
    { replaceMode: true }
  );

  console.log("\nIngestion Summary:");
  console.log(JSON.stringify(summary, null, 2));

  if (summary.errors && summary.errors.length > 0) {
    console.error("\nIngestion failed with errors.");
    process.exit(1);
  }

  if (apply) {
    console.log("\nRe-import successfully applied!");
    
    // Verify the state of Quoc Le's date and guest names in the database
    const quocLe = await prisma.reservations.findFirst({
      where: { guest_name: { contains: "Quoc Le" } }
    });
    if (quocLe) {
      console.log("\nVerified DB Record for Quoc Le:");
      console.log(`  guest_name:     ${quocLe.guest_name}`);
      console.log(`  check_in_date:  ${quocLe.check_in_date.toISOString().split("T")[0]}`);
      console.log(`  check_out_date: ${quocLe.check_out_date.toISOString().split("T")[0]}`);
    }

    // Print some of the non-English names to confirm they are properly encoded
    const foreignGuests = await prisma.reservations.findMany({
      where: {
        OR: [
          { guest_name: { contains: "정찬" } },
          { guest_name: { contains: "Trần" } },
          { guest_name: { contains: "Şt" } }
        ]
      },
      select: { guest_name: true }
    });
    console.log("\nVerified DB Records for non-English Guest Names:");
    for (const g of foreignGuests) {
      console.log(`  guest_name:     ${g.guest_name}`);
    }
  } else {
    console.log("\nCHECK mode complete. Re-run with --apply to execute the database mutations.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
