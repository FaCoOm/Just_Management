#!/usr/bin/env node
/**
 * verify-prod-env.mjs
 *
 * Production env contract verifier for CI + local preflight.
 * Consumed by TDD RED-phase checks: it should fail loudly until the required
 * production env files exist and satisfy the expected key/value contract.
 *
 * This script is read-only and self-contained: it validates repo-root
 * `.env.production`, `backend/.env.production`, and the root `.gitignore`
 * regression guard without mutating any files.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const isTTY = Boolean(process.stdout.isTTY);
const color = {
  green: (text) => (isTTY ? `\x1b[32m${text}\x1b[0m` : text),
  red: (text) => (isTTY ? `\x1b[31m${text}\x1b[0m` : text),
};

const checks = [];

function parseEnv(text) {
  const entries = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries.set(key, value);
  }
  return entries;
}

function fail(file, key, reason) {
  checks.push({ ok: false, file, key, reason });
}

function pass() {
  checks.push({ ok: true });
}

function requireKey(file, env, key, validator) {
  if (!env.has(key)) {
    fail(file, key, "missing");
    return;
  }
  const value = env.get(key);
  const result = validator(value);
  if (result !== true) {
    fail(file, key, result || "wrong value");
  } else {
    pass();
  }
}

/**
 * Validate prod env contract for frontend/backend and .gitignore guard.
 */
async function main() {
  const frontendFile = path.resolve(repoRoot, ".env.production");
  const backendFile = path.resolve(repoRoot, "backend", ".env.production");
  const gitignoreFile = path.resolve(repoRoot, ".gitignore");

  try {
    const text = await readFile(frontendFile, "utf8");
    const env = parseEnv(text);
    requireKey(frontendFile, env, "VITE_TRACK_B_API_URL", (value) =>
      value === "" || value.length > 0 ? true : "wrong value"
    );
    requireKey(frontendFile, env, "VITE_ONE_AUTH_TOKEN_URL", (value) =>
      value.startsWith("/api/") ? true : "wrong format"
    );
  } catch {
    fail(frontendFile, "__file__", "missing");
  }

  try {
    const text = await readFile(backendFile, "utf8");
    const env = parseEnv(text);
    requireKey(backendFile, env, "DATABASE_URL", (value) =>
      /^postgresql:\/\/.+sslmode=require/.test(value) ? true : "wrong format"
    );
    requireKey(backendFile, env, "PORT", (value) => (value === "3001" ? true : "wrong value"));
    requireKey(backendFile, env, "NODE_ENV", (value) => (value === "production" ? true : "wrong value"));
    requireKey(backendFile, env, "SLOW_REQUEST_THRESHOLD_MS", (value) =>
      /^\d+$/.test(value) ? true : "wrong format"
    );
    requireKey(backendFile, env, "ALLOWED_ORIGINS", (value) =>
      value.includes("https://manage.mujosaigon.com") ? true : "wrong value"
    );
    requireKey(backendFile, env, "ONE_CONNECTION_KEY", (value) =>
      /^(live::|conn_)/.test(value) ? true : "wrong format"
    );
    requireKey(backendFile, env, "ONE_SECRET_KEY", (value) =>
      /^(sk_live_|sk_test_)/.test(value) ? true : "wrong format"
    );
    requireKey(backendFile, env, "ONE_API_BASE", (value) =>
      value === "https://api.withone.ai/v1" ? true : "wrong value"
    );
    requireKey(backendFile, env, "ONE_WEBHOOK_SECRET", (value) =>
      value.startsWith("whsec_") ? true : "wrong format"
    );
    requireKey(backendFile, env, "ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE", (value) =>
      value === "user" ? true : "wrong value"
    );
    requireKey(backendFile, env, "INGEST_PIPELINE_ENABLED", (value) =>
      value === "false" ? true : "wrong value"
    );
    requireKey(backendFile, env, "INGEST_SHEETS_PROVIDER", (value) =>
      value === "withone" ? true : "wrong value"
    );
  } catch {
    fail(backendFile, "__file__", "missing");
  }

  try {
    const gitignore = await readFile(gitignoreFile, "utf8");
    if (!gitignore.includes(".env.*")) fail(gitignoreFile, ".gitignore", "missing .env.* guard");
    if (!gitignore.includes("*.env")) fail(gitignoreFile, ".gitignore", "missing *.env guard");
    if (gitignore.includes(".env.*") && gitignore.includes("*.env")) pass();
  } catch {
    fail(gitignoreFile, ".gitignore", "missing");
  }

  const failures = checks.filter((entry) => !entry.ok);
  for (const entry of failures) {
    console.error(color.red(`[FAIL] ${entry.file}:${entry.key} — ${entry.reason}`));
  }

  if (failures.length > 0) {
    process.exit(1);
  }

  console.log(color.green(`[OK] all checks passed (${checks.filter((entry) => entry.ok).length} keys validated across 2 files + .gitignore guard)`));
  process.exit(0);
}

void main();
