import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PORT = Number(process.env.VERIFY_PORT ?? String(3100 + Math.floor(Math.random() * 1000)));
const API_URL = `http://127.0.0.1:${PORT}/api/ingest`;
const TSX_CLI = path.resolve(__dirname, "../node_modules/tsx/dist/cli.mjs");
const GOOGLE_SHEETS_VERIFY_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

type IngestResponse = {
  syncRunId: string;
  dryRun: boolean;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  deadLetters: number;
  errors: Array<{ code: string; field?: string; message: string }>;
};

async function runTest(name: string, endpoint: string, filePath: string, dryRun: boolean, expectedCode: number, extraFields: Record<string, string> = {}) {
  console.log(`\n--- Running Test: ${name} ---`);
  const formData = new FormData();
  formData.append("sourceAccount", "airbnb-main");
  formData.append("dryRun", dryRun.toString());

   for (const [key, value] of Object.entries(extraFields)) {
    formData.append(key, value);
   }

  if (filePath) {
    const fullPath = path.resolve(__dirname, "../fixtures", filePath);
    const fileBuffer = fs.readFileSync(fullPath);
    const blob = new Blob([fileBuffer], { type: "text/csv" });
    formData.append("file", blob, filePath);
  }

  const response = await fetch(`${API_URL}/${endpoint}`, {
    method: "POST",
    body: formData,
  });

  console.log(`Status: ${response.status}`);
  const json = await response.json();
  console.log("Response:", JSON.stringify(json, null, 2));

  if (response.status !== expectedCode) {
    throw new Error(`Test failed: Expected status ${expectedCode}, got ${response.status}`);
  }
  return json as IngestResponse;
}

async function waitForServerReady(timeoutMs = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry until timeout
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Server did not become ready on port ${PORT} within ${timeoutMs}ms`);
}

async function verifyDb() {
  console.log("\n--- Verifying DB State ---");
  const runs = await prisma.sync_runs.count();
  const deadLetters = await prisma.sync_dead_letters.count();
  const listings = await prisma.channel_listings.count();
  const reservations = await prisma.reservations.count();
  
  console.log(`Sync Runs: ${runs}`);
  console.log(`Dead Letters: ${deadLetters}`);
  console.log(`Listings: ${listings}`);
  console.log(`Reservations: ${reservations}`);

  return { runs, deadLetters, listings, reservations };
}

async function main() {
  console.log("Starting Verification Harness...");
  console.log(`Using verification port ${PORT}`);
  
  const server = spawn(process.execPath, [TSX_CLI, "src/index.ts"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "pipe",
    shell: false,
    env: {
      ...process.env,
      PORT: String(PORT),
      M_MANAGEMENT_LISTINGS_CREATE_INVENTORY: "true",
    },
  });

  server.stdout.on("data", (data) => console.log(`[SERVER] ${data.toString().trim()}`));
  server.stderr.on("data", (data) => console.error(`[SERVER ERR] ${data.toString().trim()}`));

  await waitForServerReady();

  try {
    const beforeCounts = await verifyDb();

    // 1. Dry run - no DB mutations should occur
    const dryRunSummary = await runTest("Main-happy Dry Run", "listings", "Main-happy.csv", true, 200);
    if (dryRunSummary.processed !== 3 || dryRunSummary.deadLetters !== 0) {
      throw new Error(`Dry-run listing summary unexpected: ${JSON.stringify(dryRunSummary)}`);
    }
    const afterDryRunCounts = await verifyDb();
    if (afterDryRunCounts.listings !== beforeCounts.listings || afterDryRunCounts.reservations !== beforeCounts.reservations) {
      throw new Error("Dry run mutated business tables.");
    }

    // 2. Main-happy real run
    const mainSummary = await runTest("Main-happy Real Run", "listings", "Main-happy.csv", false, 200);
    if (mainSummary.processed !== 3 || mainSummary.deadLetters !== 0) {
      throw new Error(`Main listing sync did not import cleanly: ${JSON.stringify(mainSummary)}`);
    }

    // 3. Idempotency run - Should result in updates/skipped, not new creations
    const repeatSummary = await runTest("Main-happy Idempotency Run", "listings", "Main-happy.csv", false, 200);
    if (repeatSummary.deadLetters !== 0) {
      throw new Error(`Idempotency run produced dead letters: ${JSON.stringify(repeatSummary)}`);
    }

    // 4. Ruby/Ambiguous run
    const rubySummary = await runTest("Ruby/Ambiguous Run", "listings", "Ruby-ambiguous.csv", false, 200);
    if (rubySummary.deadLetters < 2) {
      throw new Error(`Ruby ambiguous fixture should dead-letter ambiguous rows: ${JSON.stringify(rubySummary)}`);
    }

    // 5. Malformed file - expecting 200 with errors in summary for missing columns
    const malformedSummary = await runTest("Malformed File Run", "listings", "Main-malformed.csv", false, 200);
    if (malformedSummary.deadLetters < 1) {
      throw new Error(`Malformed file should produce at least one dead letter: ${JSON.stringify(malformedSummary)}`);
    }

    // 6. Reservations
    const reservationSummary = await runTest("Reservations Run", "reservations", "Reservations-happy.csv", false, 200);
    if (
      reservationSummary.processed !== 4 ||
      reservationSummary.deadLetters !== 2 ||
      reservationSummary.created + reservationSummary.updated < 2
    ) {
      throw new Error(`Reservation sync summary unexpected: ${JSON.stringify(reservationSummary)}`);
    }

    // 7. Google Sheets mock test
    console.log(`\n--- Running Test: Google Sheets Integration ---`);
    const sheetFormData = new FormData();
    sheetFormData.append("sourceAccount", "airbnb-main");
    sheetFormData.append("dryRun", GOOGLE_SHEETS_VERIFY_ID ? "true" : "false");
    sheetFormData.append("sourceType", "google-sheets");
    sheetFormData.append("spreadsheetId", GOOGLE_SHEETS_VERIFY_ID ?? "dummy");
    sheetFormData.append("targetKind", "listings");
    const sheetRes = await fetch(`${API_URL}/google-sheets`, { method: "POST", body: sheetFormData });
    const sheetJson = await sheetRes.json();
    console.log("Google Sheets Status:", sheetRes.status);
    console.log("Response:", JSON.stringify(sheetJson, null, 2));

    if (sheetRes.status !== 200) {
      throw new Error(`Google Sheets contract call expected 200, got ${sheetRes.status}`);
    }

    if (GOOGLE_SHEETS_VERIFY_ID) {
      if (!Array.isArray(sheetJson.errors) || sheetJson.errors.length !== 0) {
        throw new Error(`Google Sheets happy-path verification returned errors: ${JSON.stringify(sheetJson)}`);
      }
      if (typeof sheetJson.processed !== "number" || sheetJson.processed < 1) {
        throw new Error(`Google Sheets happy-path verification did not process any rows: ${JSON.stringify(sheetJson)}`);
      }
    } else if (!Array.isArray(sheetJson.errors) || sheetJson.errors.length === 0) {
      throw new Error(`Google Sheets failure-path verification should return structured errors: ${JSON.stringify(sheetJson)}`);
    }

    // 8. Pipeline scaffold status should be available without exposing secrets
    console.log(`\n--- Running Test: Pipeline Status ---`);
    const pipelineStatusRes = await fetch(`${API_URL}/pipeline/status`);
    const pipelineStatusJson = await pipelineStatusRes.json();
    console.log("Pipeline Status:", pipelineStatusRes.status);
    console.log("Response:", JSON.stringify(pipelineStatusJson, null, 2));
    if (pipelineStatusRes.status !== 200) {
      throw new Error(`Pipeline status expected 200, got ${pipelineStatusRes.status}`);
    }
    if (!Array.isArray(pipelineStatusJson.connectors) || pipelineStatusJson.phase !== "scaffolded") {
      throw new Error(`Pipeline status shape unexpected: ${JSON.stringify(pipelineStatusJson)}`);
    }
    const folderWatchConnector = pipelineStatusJson.connectors.find((connector: { mode?: string }) => connector.mode === "folder-watch");
    if (!folderWatchConnector?.detail?.includes("listings/inbox") || !folderWatchConnector.detail.includes("reservations/inbox")) {
      throw new Error(`Folder-watch connector should document subfolder layout: ${JSON.stringify(folderWatchConnector)}`);
    }
    if (JSON.stringify(pipelineStatusJson).includes("private_key")) {
      throw new Error("Pipeline status leaked private credential material.");
    }

    // 9. Pipeline built-in run now executes dry-run import preview
    console.log(`\n--- Running Test: Pipeline Built-In Dry Run ---`);
    const pipelineRunRes = await fetch(`${API_URL}/pipeline/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: true, mode: "built-in", targetKind: "listings" }),
    });
    const pipelineRunJson = await pipelineRunRes.json();
    console.log("Pipeline Run Status:", pipelineRunRes.status);
    console.log("Response:", JSON.stringify(pipelineRunJson, null, 2));
    if (pipelineRunRes.status !== 200) {
      throw new Error(`Pipeline built-in dry run expected 200, got ${pipelineRunRes.status}`);
    }
    if (pipelineRunJson.dryRun !== true || pipelineRunJson.processed <= 0 || !Array.isArray(pipelineRunJson.errors) || pipelineRunJson.errors.length !== 0) {
      throw new Error(`Pipeline built-in dry run unexpected: ${JSON.stringify(pipelineRunJson)}`);
    }

    const listingRows = await prisma.channel_listings.findMany({
      where: { title: { in: ["Test Listing 1", "Test Listing 2", "Test Listing 3"] } },
      orderBy: { title: "asc" },
    });
    if (listingRows.length !== 3) {
      throw new Error(`Expected 3 persisted happy-path listings, found ${listingRows.length}`);
    }

    const reservationRefs = await prisma.reservation_external_refs.findMany({
      where: { confirmation_code: { in: ["HMX1234567", "HMX9876543"] } },
      orderBy: { confirmation_code: "asc" },
    });
    if (reservationRefs.length !== 2) {
      throw new Error(`Expected 2 persisted reservation refs for resolvable rows, found ${reservationRefs.length}`);
    }

    await verifyDb();

    console.log("\n✅ All verification scenarios executed successfully.");
  } catch (err) {
    console.error("Verification failed:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    server.kill();
  }
}

main();
