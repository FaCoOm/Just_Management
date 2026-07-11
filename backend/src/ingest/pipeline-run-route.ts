import fs from "node:fs/promises";
import path from "node:path";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { createEmptyIngestSummary, type IngestValidationError } from "./contracts";
import { getConfiguredImportRoot, isPipelineMode, isPipelineTargetKind } from "./pipeline";

type PipelineRunBody = Record<string, unknown>;

function isObject(value: unknown): value is PipelineRunBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(body: PipelineRunBody, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function getString(body: PipelineRunBody, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

function validateDryRun(body: PipelineRunBody): IngestValidationError[] {
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

function validatePipelineRun(body: PipelineRunBody): IngestValidationError[] {
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

async function runFolderWatch(targetKind: "listings" | "reservations", sourceAccount: string, dryRun: boolean) {
  const importRoot = getConfiguredImportRoot();
  if (!importRoot) {
    return createEmptyIngestSummary(targetKind, dryRun, [
      { code: "UNSUPPORTED_SOURCE", field: "M_MANAGEMENT_IMPORT_ROOT", message: "M_MANAGEMENT_IMPORT_ROOT is not configured." },
    ]);
  }

  const pending = await prisma.watched_files.findMany({
    where: { watch_dir: importRoot, target_kind: targetKind, status: "seen" },
    orderBy: { last_seen_at: "asc" },
  });
  const summary = createEmptyIngestSummary(targetKind, dryRun);

  for (const file of pending) {
    const absolutePath = path.join(importRoot, file.relative_path);
    const buffer = await fs.readFile(absolutePath);
    const ext = file.relative_path.toLowerCase();
    const mimeType = ext.endsWith(".xlsx")
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : ext.endsWith(".xls")
        ? "application/vnd.ms-excel"
        : "text/csv";

    const child = targetKind === "reservations"
      ? await (await import("./services/reservations.js")).processReservationSync(buffer, mimeType, sourceAccount, dryRun, file.relative_path, { replaceMode: true })
      : await (await import("./services/listings.js")).processListingSync(buffer, mimeType, sourceAccount, dryRun, file.relative_path);

    summary.processed += child.processed;
    summary.created += child.created;
    summary.updated += child.updated;
    summary.skipped += child.skipped;
    summary.deadLetters += child.deadLetters;
    summary.errors.push(...child.errors);

    if (!dryRun) {
      const destinationState = child.errors.length > 0 ? "quarantine" : "processed";
      const destinationPath = path.join(importRoot, targetKind, destinationState, path.basename(file.relative_path));
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.rename(absolutePath, destinationPath).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== "ENOENT") throw err;
      });
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

  return summary;
}

export async function handlePipelineRun(req: Request, res: Response): Promise<void> {
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
      res.status(200).json(await processBuiltInSeed(sourceDir, dryRun));
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
      res.status(200).json(await processEmailSync(connectionKey, targetKind, sourceAccount, dryRun));
      return;
    }

    if (mode === "google-sheets") {
      const connectionKey = getString(body, "connectionKey") || "";
      const spreadsheetId = getString(body, "spreadsheetId") || "";
      const sheetName = getString(body, "sheetName");
      const sheetsProvider = process.env.INGEST_SHEETS_PROVIDER ?? "withone";

      if (sheetsProvider === "withone" && !connectionKey) {
        res.status(400).json(createEmptyIngestSummary(targetKind, dryRun, [
          { code: "CONFIG_AUTH_FAILURE", field: "connectionKey", message: "connectionKey is required when INGEST_SHEETS_PROVIDER=withone." },
        ]));
        return;
      }

      if (sheetsProvider === "withone") {
        const { processGoogleSheetsSync } = await import("./services/sheets-one.js");
        res.status(200).json(await processGoogleSheetsSync(spreadsheetId, sheetName, targetKind, sourceAccount, dryRun, connectionKey));
        return;
      }

      const { processGoogleSheetsSync } = await import("./services/sheets.js");
      res.status(200).json(await processGoogleSheetsSync(spreadsheetId, sheetName, targetKind, sourceAccount, dryRun));
      return;
    }

    if (mode === "folder-watch") {
      res.status(200).json(await runFolderWatch(targetKind, sourceAccount, dryRun));
      return;
    }

    res.status(501).json(createEmptyIngestSummary(targetKind, dryRun, [
      { code: "SYNC_NOT_IMPLEMENTED", field: "mode", message: "Pipeline mode is not executable yet." },
    ]));
  } catch (err) {
    res.status(500).json(createEmptyIngestSummary(targetKind, dryRun, [
      { code: "MALFORMED_FILE", message: err instanceof Error ? err.message : "Pipeline run failed." },
    ]));
  }
}
