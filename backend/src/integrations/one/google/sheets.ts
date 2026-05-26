import { passthrough } from "../client.js";

const SHEETS_VALUES_BATCH_GET_ACTION_ID = "conn_mod_def::GJ30kpWG-z8::VMMRhQGBT_ei-wq4JK7Sow";
const SHEETS_GET_SPREADSHEET_ACTION_ID = "conn_mod_def::GJ30jpJCuBA::-7kldtebSUeO7_FYtT48JQ";

interface SpreadsheetMetadataResponse {
  sheets?: Array<{
    properties?: {
      title?: unknown;
    };
  }>;
}

interface BatchGetValuesResponse {
  valueRanges?: Array<{
    values?: unknown[][];
  }>;
}

async function resolveFirstSheetName(connectionKey: string, spreadsheetId: string): Promise<string> {
  const metadata = await passthrough<SpreadsheetMetadataResponse>({
    connectionKey,
    actionId: SHEETS_GET_SPREADSHEET_ACTION_ID,
    method: "GET",
    path: `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
    query: { includeGridData: "false" },
  });

  const firstSheetTitle = metadata.sheets?.[0]?.properties?.title;
  if (typeof firstSheetTitle !== "string" || firstSheetTitle.length === 0) {
    throw new Error("Could not determine a sheet name to ingest from the target spreadsheet.");
  }

  return firstSheetTitle;
}

function coerceValues(values: unknown[][]): string[][] {
  return values.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}

export async function fetchSheetValues(
  connectionKey: string,
  spreadsheetId: string,
  sheetName?: string,
): Promise<string[][]> {
  const selectedSheetName = sheetName || await resolveFirstSheetName(connectionKey, spreadsheetId);
  const range = `${selectedSheetName}!A:ZZ`;

  const data = await passthrough<BatchGetValuesResponse>({
    connectionKey,
    actionId: SHEETS_VALUES_BATCH_GET_ACTION_ID,
    method: "GET",
    path: `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`,
    query: {
      ranges: [range],
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    },
  });

  return coerceValues(data.valueRanges?.[0]?.values ?? []);
}
