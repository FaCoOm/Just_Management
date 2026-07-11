import type { Express, Request, Response } from "express";
import multer from "multer";
import {
  createEmptyIngestSummary,
  ingestFileContract,
  sourceTypes,
  type IngestKind,
  type IngestValidationError,
} from "./contracts";
import {
  getPipelineStatus,
} from "./pipeline";
import { handleGoogleSheetsIngest } from "./google-sheets-route";
import { handlePipelineRun } from "./pipeline-run-route";

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
  if (!sourceAccount || sourceAccount.trim().length === 0) {
    return [
      {
        code: "UNSUPPORTED_SOURCE",
        field: "sourceAccount",
        message: "sourceAccount is required and must be a non-empty string.",
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

function validateIngestRequest(req: Request, kind: IngestKind): IngestValidationError[] {
  const body = isObject(req.body) ? req.body : {};
  const expectedSourceType = kind === "google-sheets" ? "google-sheets" : undefined;

  return [
    ...validateDryRun(body),
    ...validateSourceAccount(body),
    ...validateSourceType(body, expectedSourceType),
    ...validateDeclaredFile(body, req.file),
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

  upload.single("file")(req as any, res as any, (error) => {
    if (error) {
      sendMalformedMultipartError(res, error);
      return;
    }

    next();
  });
}

export function registerIngestRoutes(app: Express): void {
  app.get("/api/ingest/pipeline/status", (_req, res) => {
    res.status(200).json(getPipelineStatus());
  });

	app.post("/api/ingest/pipeline/run", handlePipelineRun);

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
        const summary = await processListingSync(req.file.buffer, req.file.mimetype, sourceAccount, dryRun, req.file.originalname);
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
    const replaceMode = body.replaceMode !== false && body.replaceMode !== "false";

    const errors = validateIngestRequest(req, "reservations");
    if (errors.length > 0) {
      res.status(400).json(createEmptyIngestSummary("reservations", dryRun, errors));
      return;
    }

    if ((body.replaceMode === true || body.replaceMode === "true") && dryRun) {
      res.status(400).json(createEmptyIngestSummary("reservations", dryRun, [
        {
          code: "MISSING_DRY_RUN",
          field: "replaceMode",
          message: "replaceMode cannot be combined with dryRun=true; replace is destructive and requires a real run.",
        },
      ]));
      return;
    }

    if (req.file) {
      try {
        const { processReservationSync } = await import("./services/reservations.js");
        const summary = await processReservationSync(
          req.file.buffer,
          req.file.mimetype,
          sourceAccount,
          dryRun,
          req.file.originalname,
          { replaceMode },
        );
        const replaceBlocked = summary.errors.find((err) => err.code === "REPLACE_BLOCKED_BY_TAX_EXPORT");
        if (replaceBlocked) {
          res.status(409).json(summary);
          return;
        }
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

	app.post("/api/ingest/google-sheets", parseOptionalMultipart, handleGoogleSheetsIngest);
}
