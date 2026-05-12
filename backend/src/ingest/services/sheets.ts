import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import * as xlsx from "xlsx";
import { createEmptyIngestSummary, type IngestSummaryResponse } from "../contracts";
import { processListingSync } from "./listings";
import { processReservationSync } from "./reservations";

function resolveCredentialFilePath(): string | null {
  const configuredPath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!configuredPath) {
    return null;
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
}

function credentialFileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

async function resolveSheetRange(spreadsheetId: string, sheetName: string | undefined): Promise<string[][]> {
  const credentialFilePath = resolveCredentialFilePath();
  if (!credentialFilePath || !credentialFileExists(credentialFilePath)) {
    throw new Error("Google Sheets integration requires a readable service-account credential file.");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialFilePath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  let selectedSheetName: string | undefined = sheetName;
  if (!selectedSheetName) {
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
    });

    const firstSheetTitle = metadata.data.sheets?.[0]?.properties?.title;
    selectedSheetName = firstSheetTitle ?? undefined;
  }

  if (!selectedSheetName) {
    throw new Error("Could not determine a sheet name to ingest from the target spreadsheet.");
  }

  const valuesResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${selectedSheetName}!A:ZZ`,
  });

  const values = valuesResponse.data.values;
  if (!values || values.length === 0) {
    throw new Error("The target Google Sheet does not contain any rows.");
  }

  return values;
}

function valuesToCsvBuffer(values: string[][]): Buffer {
  const worksheet = xlsx.utils.aoa_to_sheet(values);
  const csv = xlsx.utils.sheet_to_csv(worksheet);
  return Buffer.from(csv, "utf8");
}

export async function processGoogleSheetsSync(
  spreadsheetId: string,
  sheetName: string | undefined,
  targetKind: "listings" | "reservations",
  sourceAccount: string,
  isDryRun: boolean
): Promise<IngestSummaryResponse> {
  const requestedSpreadsheetId = spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "";
  if (!requestedSpreadsheetId) {
    return createEmptyIngestSummary(targetKind, isDryRun, [
      {
        code: "CONFIG_AUTH_FAILURE",
        field: "spreadsheetId",
        message: "A spreadsheetId is required for Google Sheets ingestion.",
      },
    ]);
  }

  try {
    const values = await resolveSheetRange(requestedSpreadsheetId, sheetName);
    const csvBuffer = valuesToCsvBuffer(values);

    if (targetKind === "listings") {
      return processListingSync(csvBuffer, "text/csv", sourceAccount, isDryRun);
    }

    return processReservationSync(csvBuffer, "text/csv", sourceAccount, isDryRun);
  } catch (error) {
    return createEmptyIngestSummary(targetKind, isDryRun, [
      {
        code: "CONFIG_AUTH_FAILURE",
        field: "credentials",
        message: error instanceof Error ? error.message : "Google Sheets ingestion failed.",
      },
    ]);
  }
}
