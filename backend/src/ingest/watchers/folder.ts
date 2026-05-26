import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type InferredFolderTargetKind = "listings" | "reservations" | "unknown";

export function inferTargetKind(fileName: string): InferredFolderTargetKind {
  if (/^listings?[._-]/i.test(fileName)) return "listings";
  if (/^reservations?[._-]/i.test(fileName)) return "reservations";
  return "unknown";
}

async function sha256(buffer: Buffer): Promise<string> {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function recordWatchedFile(watchDir: string, absoluteFilePath: string): Promise<void> {
  const stat = await fs.stat(absoluteFilePath);
  if (!stat.isFile()) return;
  const buffer = await fs.readFile(absoluteFilePath);
  const relativePath = path.relative(watchDir, absoluteFilePath).replace(/\\/g, "/");
  const contentSha256 = await sha256(buffer);

  await prisma.watched_files.upsert({
    where: {
      watch_dir_relative_path_content_sha256: {
        watch_dir: watchDir,
        relative_path: relativePath,
        content_sha256: contentSha256,
      },
    },
    create: {
      watch_dir: watchDir,
      relative_path: relativePath,
      size_bytes: BigInt(stat.size),
      mtime: stat.mtime,
      content_sha256: contentSha256,
      status: inferTargetKind(path.basename(relativePath)) === "unknown" ? "skipped" : "seen",
      failure_reason: inferTargetKind(path.basename(relativePath)) === "unknown" ? "unsupported filename pattern" : null,
    },
    update: {
      size_bytes: BigInt(stat.size),
      mtime: stat.mtime,
      last_seen_at: new Date(),
    },
  });
}

export function startFolderWatcher(): FSWatcher | null {
  const enabled = process.env.INGEST_PIPELINE_ENABLED !== "false";
  const watchDir = process.env.M_MANAGEMENT_WATCH_DIR;
  if (!enabled || !watchDir) return null;

  const resolved = path.isAbsolute(watchDir) ? watchDir : path.resolve(process.cwd(), watchDir);
  const watcher = chokidar.watch(resolved, {
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 200 },
  });

  watcher.on("add", (filePath) => {
    recordWatchedFile(resolved, filePath).catch((err) => console.error("folder watch add failed", err));
  });
  watcher.on("change", (filePath) => {
    recordWatchedFile(resolved, filePath).catch((err) => console.error("folder watch change failed", err));
  });
  watcher.on("error", (err) => console.error("folder watcher failed", err));
  return watcher;
}