import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
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
import {
  getPipelineStatus,
  isPipelineMode,
  isPipelineTargetKind,
} from "./pipeline";

type RequestBody = Record<string, unknown>;
const prisma = new PrismaClient();

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

function validatePipelineRun(body: RequestBody): IngestValidationError[] {
  const errors: IngestValidationError[] = [];
  const mode = getString(body, "mode");
  const targetKind = getString(body, "targetKind");

  if (!mode || !isPipelineMode(mode)) {
    errors.push({
      code: "UNSUPPORTED_SOURCE",
      field: "mode",
      message: "mode must be one of: admin-upload, folder-watch, email, built-in, google-sheets.",
    });
  }

  if (!targetKind || !isPipelineTargetKind(targetKind)) {
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
  app.get("/api/ingest/pipeline/status", (_req, res) => {
    res.status(200).json(getPipelineStatus());
  });

  app.post("/api/ingest/pipeline/run", async (req, res) => {
    const body = isObject(req.body) ? req.body : {};
    const dryRun = body.dryRun === true || body.dryRun === "true";
    const targetKind = getString(body, "targetKind") === "reservations" ? "reservations" : "listings";
    const mode = getString(body, "mode");
    const sourceAccount = getString(body, "sourceAccount") || "airbnb-main";
    const errors = [...validateDryRun(body), ...validatePipelineRun(body)];

    if (errors.length > 0) {
      res.status(400).json(createEmptyIngestSummary(targetKind, dryRun, errors));
      return;
    }

    try {
      if (mode === "built-in") {
        const sourceDir = getString(body, "sourceDir");
        const { processBuiltInSeed } = await import("./services/seed-builtin.js");
        const summary = await processBuiltInSeed(sourceDir, dryRun);
        res.status(200).json(summary);
        return;
      }

      if (mode === "email") {
        const connectionKey = getString(body, "connectionKey") || "";
        if (!connectionKey) {
          res.status(400).json(createEmptyIngestSummary(targetKind, dryRun, [
            { code: "CONFIG_AUTH_FAILURE", field: "connectionKey", message: "connectionKey is required for email ingestion." },
          ]));
          return;
        }
        const { processEmailSync } = await import("./services/email.js");
        const summary = await processEmailSync(connectionKey, targetKind, sourceAccount, dryRun);
        res.status(200).json(summary);
        return;
      }

      if (mode === "folder-watch") {
        const watchDir = process.env.M_MANAGEMENT_WATCH_DIR;
        if (!watchDir) {
          res.status(400).json(createEmptyIngestSummary(targetKind, dryRun, [
            { code: "UNSUPPORTED_SOURCE", field: "M_MANAGEMENT_WATCH_DIR", message: "M_MANAGEMENT_WATCH_DIR is not configured." },
          ]));
          return;
        }
        const resolvedWatchDir = path.isAbsolute(watchDir) ? watchDir : path.resolve(process.cwd(), watchDir);
        const targetPrefix = targetKind === "listings" ? /^listings?[._-]/i : /^reservations?[._-]/i;
        const pending = await prisma.watched_files.findMany({ where: { watch_dir: resolvedWatchDir, status: "seen" }, orderBy: { last_seen_at: "asc" } });
        const candidates = pending.filter((file) => targetPrefix.test(path.basename(file.relative_path)));
        const summary = createEmptyIngestSummary(targetKind, dryRun);
        const processor = targetKind === "listings"
          ? (await import("./services/listings.js")).processListingSync
          : (await import("./services/reservations.js")).processReservationSync;

        for (const file of candidates) {
          const absolutePath = path.join(resolvedWatchDir, file.relative_path);
          const buffer = await fs.readFile(absolutePath);
          const child = await processor(buffer, "text/csv", sourceAccount, dryRun);
          summary.processed += child.processed;
          summary.created += child.created;
          summary.updated += child.updated;
          summary.skipped += child.skipped;
          summary.deadLetters += child.deadLetters;
          summary.errors.push(...child.errors);
          if (!dryRun) {
            await prisma.watched_files.update({
              where: { id: file.id },
              data: {
                status: child.errors.length > 0 ? "quarantined" : "processed",
                failure_reason: child.errors[0]?.message ?? null,
                last_processed_at: new Date(),
                last_sync_run_id: child.syncRunId.startsWith("dry-run-") ? null : child.syncRunId,
              },
            });
          }
        }
        res.status(200).json(summary);
        return;
      }

      res.status(501).json(createEmptyIngestSummary(targetKind, dryRun, [
        {
          code: "SYNC_NOT_IMPLEMENTED",
          field: "mode",
          message: "Pipeline mode is not executable yet.",
        },
      ]));
    } catch (err) {
      res.status(500).json(createEmptyIngestSummary(targetKind, dryRun, [
        { code: "MALFORMED_FILE", message: err instanceof Error ? err.message : "Pipeline run failed." },
      ]));
    }
  });

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
    const sheetsProvider = process.env.INGEST_SHEETS_PROVIDER ?? "google-sheets-direct";

    const errors = validateIngestRequest(req, "google-sheets");
    if (errors.length > 0) {
      res.status(400).json(createEmptyIngestSummary("google-sheets", dryRun, errors));
      return;
    }

    try {
      if (sheetsProvider === "withone") {
        const connectionKey = getString(body, "connectionKey") || "";
        if (!connectionKey) {
          res.status(400).json(createEmptyIngestSummary("google-sheets", dryRun, [
            {
              code: "CONFIG_AUTH_FAILURE",
              field: "connectionKey",
              message: "connectionKey is required when INGEST_SHEETS_PROVIDER=withone.",
            },
          ]));
          return;
        }

        const { processGoogleSheetsSync } = await import("./services/sheets-one.js");
        const summary = await processGoogleSheetsSync(spreadsheetId, sheetName, targetKind, sourceAccount, dryRun, connectionKey);
        res.status(200).json(summary);
        return;
      }

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
