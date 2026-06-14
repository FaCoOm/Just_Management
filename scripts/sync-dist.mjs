#!/usr/bin/env node
/**
 * sync-dist.mjs
 *
 * Build helper: mirrors `frontend/dist/` -> repo-root `dist/`.
 *
 * Why this exists:
 *   - Hostinger's deploy pipeline expects a top-level `dist/` after the build.
 *   - This monorepo emits to `frontend/dist/` (Vite) and `backend/dist/` (tsc).
 *   - `backend/src/index.ts` ALREADY serves the SPA from `path.resolve(__dirname, "../../dist")`
 *     i.e. the repo-root `dist/`. So one consolidated `dist/` at root satisfies
 *     BOTH the Hostinger pipeline and the Express runtime.
 *
 * Behavior:
 *   - Removes existing root `dist/`.
 *   - Copies `frontend/dist/` to root `dist/` recursively.
 *   - Root `dist/` is gitignored (.gitignore line 15) so this never touches tracked files.
 *
 * Run:
 *   node scripts/sync-dist.mjs
 *
 * This is invoked automatically by the root `postbuild` script.
 */

import { existsSync, rmSync, cpSync, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(import.meta.url), "..", "..");
const source = resolve(repoRoot, "frontend", "dist");
const target = resolve(repoRoot, "dist");

if (!existsSync(source)) {
  console.error(
    `[sync-dist] Source not found: ${source}\n` +
      `Run \`npm run build -w frontend\` first.`
  );
  process.exit(1);
}

const sourceStat = statSync(source);
if (!sourceStat.isDirectory()) {
  console.error(`[sync-dist] Source is not a directory: ${source}`);
  process.exit(1);
}

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
}

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

console.log(`[sync-dist] Mirrored ${source} -> ${target}`);
