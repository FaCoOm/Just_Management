import type { Request, Response } from "express";
import { createEmptyIngestSummary, type IngestValidationError } from "./contracts";

type GoogleSheetsBody = Record<string, unknown>;

function isObject(value: unknown): value is GoogleSheetsBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(body: GoogleSheetsBody, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

function validateGoogleSheets(body: GoogleSheetsBody): IngestValidationError[] {
  const errors: IngestValidationError[] = [];
  const spreadsheetId = getString(body, "spreadsheetId");
  const targetKind = getString(body, "targetKind");

  if (!spreadsheetId || spreadsheetId.trim().length === 0) {
    errors.push({
      code: "CONFIG_AUTH_FAILURE",
      field: "spreadsheetId",
      message: "spreadsheetId is required for the Google Sheets ingest contract.",
    });
  }

  if (targetKind !== "listings" && targetKind !== "reservations") {
    errors.push({
      code: "UNSUPPORTED_SOURCE",
      field: "targetKind",
      message: "targetKind must be listings or reservations.",
    });
  }

  return errors;
}

export async function handleGoogleSheetsIngest(req: Request, res: Response): Promise<void> {
  const body = isObject(req.body) ? req.body : {};
  const dryRun = body.dryRun === true || body.dryRun === "true";
  const sourceAccount = getString(body, "sourceAccount") || "";
  const spreadsheetId = getString(body, "spreadsheetId") || "";
  const sheetName = getString(body, "sheetName");
  const targetKind = getString(body, "targetKind") === "reservations" ? "reservations" : "listings";
  const sheetsProvider = process.env.INGEST_SHEETS_PROVIDER ?? "withone";
  const errors = validateGoogleSheets(body);

  if (errors.length > 0) {
    res.status(400).json(createEmptyIngestSummary("google-sheets", dryRun, errors));
    return;
  }

  try {
    if (sheetsProvider === "withone") {
      const connectionKey = getString(body, "connectionKey") || "";
      if (!connectionKey) {
        res.status(400).json(createEmptyIngestSummary("google-sheets", dryRun, [
          { code: "CONFIG_AUTH_FAILURE", field: "connectionKey", message: "connectionKey is required when INGEST_SHEETS_PROVIDER=withone." },
        ]));
        return;
      }

      const { processGoogleSheetsSync } = await import("./services/sheets-one.js");
      res.status(200).json(await processGoogleSheetsSync(spreadsheetId, sheetName, targetKind, sourceAccount, dryRun, connectionKey));
      return;
    }

    const { processGoogleSheetsSync } = await import("./services/sheets.js");
    res.status(200).json(await processGoogleSheetsSync(spreadsheetId, sheetName, targetKind, sourceAccount, dryRun));
  } catch (err) {
    res.status(500).json(createEmptyIngestSummary("google-sheets", dryRun, [
      { code: "CONFIG_AUTH_FAILURE", message: err instanceof Error ? err.message : "Internal error" },
    ]));
  }
}
