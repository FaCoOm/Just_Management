import type { Express, Request, Response } from "express";
import multer from "multer";
import {
  createEmptyIngestSummary,
  ingestFileContract,
  sourceAccounts,
  sourceTypes,
  type IngestKind,
  type IngestValidationError,
} from "./contracts";

type RequestBody = Record<string, unknown>;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ingestFileContract.maxFileSizeBytes },
});

function isObject(value: unknown): value is RequestBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(body: RequestBody, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function getString(body: RequestBody, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

function validateDryRun(body: RequestBody): IngestValidationError[] {
  if (!hasOwn(body, "dryRun") || (body.dryRun !== true && body.dryRun !== "true" && body.dryRun !== false && body.dryRun !== "false")) {
    return [
      {
        code: "MISSING_DRY_RUN",
        field: "dryRun",
        message: "dryRun is mandatory (true or false).",
      },
    ];
  }

  return [];
}

function validateSourceAccount(body: RequestBody): IngestValidationError[] {
  const sourceAccount = getString(body, "sourceAccount");
  if (!sourceAccount || !sourceAccounts.includes(sourceAccount as (typeof sourceAccounts)[number])) {
    return [
      {
        code: "UNSUPPORTED_SOURCE",
        field: "sourceAccount",
        message: `sourceAccount must be one of: ${sourceAccounts.join(", ")}.`,
      },
    ];
  }

  return [];
}

function validateSourceType(body: RequestBody, expected?: "google-sheets"): IngestValidationError[] {
  const sourceType = getString(body, "sourceType");

  if (expected && sourceType && sourceType !== expected) {
    return [
      {
        code: "UNSUPPORTED_SOURCE",
        field: "sourceType",
        message: `sourceType must be ${expected} for this endpoint.`,
      },
    ];
  }

  if (sourceType && !sourceTypes.includes(sourceType as (typeof sourceTypes)[number])) {
    return [
      {
        code: "UNSUPPORTED_SOURCE",
        field: "sourceType",
        message: `sourceType must be one of: ${sourceTypes.join(", ")}.`,
      },
    ];
  }

  return [];
}

function validateDeclaredFile(body: RequestBody, file?: Express.Multer.File): IngestValidationError[] {
  const errors: IngestValidationError[] = [];
  const mimeType = file?.mimetype ?? getString(body, "mimeType");
  const fileSizeBytes = file?.size ?? body.fileSizeBytes;

  if (mimeType && !ingestFileContract.allowedMimeTypes.includes(mimeType as (typeof ingestFileContract.allowedMimeTypes)[number])) {
    errors.push({
      code: "MALFORMED_FILE",
      field: file ? "file" : "mimeType",
      message: `mimeType must be one of: ${ingestFileContract.allowedMimeTypes.join(", ")}.`,
    });
  }

  if (fileSizeBytes !== undefined) {
    if (typeof fileSizeBytes !== "number" || !Number.isFinite(fileSizeBytes) || fileSizeBytes < 0) {
      errors.push({
        code: "MALFORMED_FILE",
        field: file ? "file" : "fileSizeBytes",
        message: "fileSizeBytes must be a non-negative finite number.",
      });
    } else if (fileSizeBytes > ingestFileContract.maxFileSizeBytes) {
      errors.push({
        code: "MALFORMED_FILE",
        field: file ? "file" : "fileSizeBytes",
        message: `fileSizeBytes must not exceed ${ingestFileContract.maxFileSizeBytes}.`,
      });
    }
  }

  return errors;
}

function validateGoogleSheets(body: RequestBody): IngestValidationError[] {
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

function validateIngestRequest(req: Request, kind: IngestKind): IngestValidationError[] {
  const body = isObject(req.body) ? req.body : {};
  const expectedSourceType = kind === "google-sheets" ? "google-sheets" : undefined;

  return [
    ...validateDryRun(body),
    ...validateSourceAccount(body),
    ...validateSourceType(body, expectedSourceType),
    ...validateDeclaredFile(body, req.file),
    ...(kind === "google-sheets" ? validateGoogleSheets(body) : []),
  ];
}

function sendIngestContractResponse(req: Request, res: Response, kind: IngestKind): void {
  const body = isObject(req.body) ? req.body : {};
  const dryRun = body.dryRun === true || body.dryRun === "true";
  const errors = validateIngestRequest(req, kind);
  const summary = createEmptyIngestSummary(kind, dryRun, errors);

  res.status(errors.length > 0 ? 400 : 200).json(summary);
}

function sendMalformedMultipartError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Multipart payload could not be parsed.";
  const summary = createEmptyIngestSummary("listings", false, [
    {
      code: "MALFORMED_FILE",
      field: "file",
      message,
    },
  ]);

  res.status(400).json(summary);
}

function parseOptionalMultipart(req: Request, res: Response, next: () => void): void {
  if (!req.is("multipart/form-data")) {
    next();
    return;
  }

  upload.single("file")(req, res, (error) => {
    if (error) {
      sendMalformedMultipartError(res, error);
      return;
    }

    next();
  });
}

export function registerIngestRoutes(app: Express): void {
  app.post("/api/ingest/listings", parseOptionalMultipart, async (req, res) => {
    const body = isObject(req.body) ? req.body : {};
    const dryRun = body.dryRun === true || body.dryRun === "true";
    const sourceAccount = getString(body, "sourceAccount") || "";
    
    const errors = validateIngestRequest(req, "listings");
    if (errors.length > 0) {
      res.status(400).json(createEmptyIngestSummary("listings", dryRun, errors));
      return;
    }

    if (req.file) {
      try {
        const { processListingSync } = await import("./services/listings.js");
        const summary = await processListingSync(req.file.buffer, req.file.mimetype, sourceAccount, dryRun);
        res.status(200).json(summary);
      } catch (err) {
        res.status(500).json(createEmptyIngestSummary("listings", dryRun, [
          { code: "MALFORMED_FILE", message: err instanceof Error ? err.message : "Internal error" }
        ]));
      }
    } else {
       sendIngestContractResponse(req, res, "listings");
    }
  });

  app.post("/api/ingest/reservations", parseOptionalMultipart, async (req, res) => {
    const body = isObject(req.body) ? req.body : {};
    const dryRun = body.dryRun === true || body.dryRun === "true";
    const sourceAccount = getString(body, "sourceAccount") || "";

    const errors = validateIngestRequest(req, "reservations");
    if (errors.length > 0) {
      res.status(400).json(createEmptyIngestSummary("reservations", dryRun, errors));
      return;
    }

    if (req.file) {
      try {
        const { processReservationSync } = await import("./services/reservations.js");
        const summary = await processReservationSync(req.file.buffer, req.file.mimetype, sourceAccount, dryRun);
        res.status(200).json(summary);
      } catch (err) {
        res.status(500).json(createEmptyIngestSummary("reservations", dryRun, [
          { code: "MALFORMED_FILE", message: err instanceof Error ? err.message : "Internal error" }
        ]));
      }
    } else {
       sendIngestContractResponse(req, res, "reservations");
    }
  });

  app.post("/api/ingest/google-sheets", parseOptionalMultipart, async (req, res) => {
    const body = isObject(req.body) ? req.body : {};
    const dryRun = body.dryRun === true || body.dryRun === "true";
    const sourceAccount = getString(body, "sourceAccount") || "";
    const spreadsheetId = getString(body, "spreadsheetId") || "";
    const sheetName = getString(body, "sheetName");
    const targetKind = getString(body, "targetKind") as "listings" | "reservations";

    const errors = validateIngestRequest(req, "google-sheets");
    if (errors.length > 0) {
      res.status(400).json(createEmptyIngestSummary("google-sheets", dryRun, errors));
      return;
    }

    try {
      const { processGoogleSheetsSync } = await import("./services/sheets.js");
      const summary = await processGoogleSheetsSync(spreadsheetId, sheetName, targetKind, sourceAccount, dryRun);
      res.status(200).json(summary);
    } catch (err) {
      res.status(500).json(createEmptyIngestSummary("google-sheets", dryRun, [
        { code: "CONFIG_AUTH_FAILURE", message: err instanceof Error ? err.message : "Internal error" }
      ]));
    }
  });
}
