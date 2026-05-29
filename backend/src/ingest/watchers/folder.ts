import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { prisma } from "../../lib/prisma";
import { getConfiguredImportRoot, type PipelineTargetKind } from "../pipeline";

const targetKinds: PipelineTargetKind[] = ["listings", "reservations"];
const importStates = ["inbox", "processed", "quarantine"] as const;

async function sha256(buffer: Buffer): Promise<string> {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function recordWatchedFile(
  importRoot: string,
  absoluteFilePath: string,
  targetKind: PipelineTargetKind
): Promise<void> {
  const stat = await fsp.stat(absoluteFilePath);
  if (!stat.isFile()) return;
  const buffer = await fsp.readFile(absoluteFilePath);
  const relativePath = path.relative(importRoot, absoluteFilePath).replace(/\\/g, "/");
  const contentSha256 = await sha256(buffer);

  await prisma.watched_files.upsert({
    where: {
      watch_dir_relative_path_content_sha256: {
        watch_dir: importRoot,
        relative_path: relativePath,
        content_sha256: contentSha256,
      },
    },
    create: {
      watch_dir: importRoot,
      relative_path: relativePath,
      size_bytes: BigInt(stat.size),
      mtime: stat.mtime,
      content_sha256: contentSha256,
      status: "seen",
      target_kind: targetKind,
    },
    update: {
      size_bytes: BigInt(stat.size),
      mtime: stat.mtime,
      last_seen_at: new Date(),
      target_kind: targetKind,
    },
  });
}

function ensureImportSubdirectories(importRoot: string): void {
  for (const targetKind of targetKinds) {
    for (const state of importStates) {
      fs.mkdirSync(path.join(importRoot, targetKind, state), { recursive: true });
    }
  }
}

function targetKindForFile(importRoot: string, absoluteFilePath: string): PipelineTargetKind | null {
  const relativePath = path.relative(importRoot, absoluteFilePath).replace(/\\/g, "/");
  if (relativePath.startsWith("listings/inbox/")) return "listings";
  if (relativePath.startsWith("reservations/inbox/")) return "reservations";
  return null;
}

export function startFolderWatcher(): FSWatcher | null {
  const enabled = process.env.INGEST_PIPELINE_ENABLED !== "false";
  const importRoot = getConfiguredImportRoot();
  if (!enabled || !importRoot) return null;

  ensureImportSubdirectories(importRoot);

  const watcher = chokidar.watch(
    targetKinds.map((targetKind) => path.join(importRoot, targetKind, "inbox")),
    {
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 200 },
    }
  );

  watcher.on("add", (filePath) => {
    const targetKind = targetKindForFile(importRoot, filePath);
    if (targetKind) recordWatchedFile(importRoot, filePath, targetKind).catch((err) => console.error("folder watch add failed", err));
  });
  watcher.on("change", (filePath) => {
    const targetKind = targetKindForFile(importRoot, filePath);
    if (targetKind) recordWatchedFile(importRoot, filePath, targetKind).catch((err) => console.error("folder watch change failed", err));
  });
  watcher.on("error", (err) => console.error("folder watcher failed", err));
  return watcher;
}
