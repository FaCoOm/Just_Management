import * as xlsx from "xlsx";
import { fetchSheetValues } from "../../integrations/one/google/sheets.js";
import { createEmptyIngestSummary, type IngestSummaryResponse } from "../contracts";
import { processListingSync } from "./listings";
import { processReservationSync } from "./reservations";

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
  isDryRun: boolean,
  connectionKey: string,
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

  if (!connectionKey) {
    return createEmptyIngestSummary(targetKind, isDryRun, [
      {
        code: "CONFIG_AUTH_FAILURE",
        field: "connectionKey",
        message: "A connectionKey is required for withone Google Sheets ingestion.",
      },
    ]);
  }

  try {
    const values = await fetchSheetValues(connectionKey, requestedSpreadsheetId, sheetName);
    if (values.length === 0) {
      throw new Error("The target Google Sheet does not contain any rows.");
    }

    const csvBuffer = valuesToCsvBuffer(values);

    if (targetKind === "listings") {
      return processListingSync(csvBuffer, "text/csv", sourceAccount, isDryRun);
    }

    return processReservationSync(csvBuffer, "text/csv", sourceAccount, isDryRun);
  } catch (error) {
    return createEmptyIngestSummary(targetKind, isDryRun, [
      {
        code: "CONFIG_AUTH_FAILURE",
        field: "connectionKey",
        message: error instanceof Error ? error.message : "Google Sheets ingestion failed.",
      },
    ]);
  }
}
