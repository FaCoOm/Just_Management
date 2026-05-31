export const ingestKinds = ["listings", "reservations", "google-sheets"] as const;
export type IngestKind = (typeof ingestKinds)[number];

export const sourceTypes = ["json", "multipart", "google-sheets"] as const;
export type IngestSourceType = (typeof sourceTypes)[number];

export type SourceAccount = string;

export const ingestErrorCodes = [
  "MISSING_DRY_RUN",
  "MALFORMED_FILE",
  "UNSUPPORTED_SOURCE",
  "UNRESOLVED_LISTING",
  "AMBIGUOUS_LISTING_MATCH",
  "CONFIG_AUTH_FAILURE",
  "SYNC_NOT_IMPLEMENTED",
] as const;
export type IngestErrorCode = (typeof ingestErrorCodes)[number];

export const ingestFileContract = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  allowedMimeTypes: [
    "text/csv",
    "application/csv",
    "application/json",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
} as const;

export interface IngestValidationError {
  code: IngestErrorCode;
  message: string;
  field?: string;
}

export interface IngestSummaryResponse {
  syncRunId: string;
  dryRun: boolean;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  deadLetters: number;
  errors: IngestValidationError[];
}

export interface BaseIngestJsonRequest {
  dryRun: true;
  sourceType?: Extract<IngestSourceType, "json" | "multipart">;
  sourceAccount: SourceAccount;
  fileName?: string;
  mimeType?: (typeof ingestFileContract.allowedMimeTypes)[number];
  fileSizeBytes?: number;
  records?: unknown[];
}

export interface BaseIngestMultipartRequest {
  dryRun: "true";
  sourceType?: Extract<IngestSourceType, "multipart">;
  sourceAccount: SourceAccount;
  file: {
    fieldName: "file";
    originalName: string;
    mimeType: (typeof ingestFileContract.allowedMimeTypes)[number];
    sizeBytes: number;
  };
}

export interface GoogleSheetsIngestJsonRequest {
  dryRun: true;
  sourceType: Extract<IngestSourceType, "google-sheets">;
  sourceAccount: SourceAccount;
  spreadsheetId: string;
  sheetName?: string;
  targetKind: Exclude<IngestKind, "google-sheets">;
}

export type ListingsIngestRequest = BaseIngestJsonRequest | BaseIngestMultipartRequest;
export type ReservationsIngestRequest = BaseIngestJsonRequest | BaseIngestMultipartRequest;
export type GoogleSheetsIngestRequest = GoogleSheetsIngestJsonRequest;

export function createEmptyIngestSummary(
  kind: IngestKind,
  dryRun: boolean,
  errors: IngestValidationError[] = [],
): IngestSummaryResponse {
  return {
    syncRunId: `dry-run-${kind}-${Date.now()}`,
    dryRun,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    deadLetters: 0,
    errors,
  };
}
