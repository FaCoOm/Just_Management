/**
 * Azure PostgreSQL Migration Guard
 *
 * Verifies that Prisma migration SQL is safe for Azure PostgreSQL deployment.
 * Run: node scripts/verify-azure-migration.mjs
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = join(__dirname, "..");
const migrationsDir = join(backendDir, "prisma", "migrations");

const BANNED_PATTERNS = [
  { pattern: /TO\s+anon/gi, name: "Supabase 'anon' role" },
  { pattern: /TO\s+authenticated/gi, name: "Supabase 'authenticated' role" },
  { pattern: /TO\s+service_role/gi, name: "Supabase 'service_role' role" },
  { pattern: /ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi, name: "ENABLE ROW LEVEL SECURITY (RLS)" },
];

const INIT_REQUIRED_PATTERNS = [
  { pattern: /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pgcrypto/gi, name: "pgcrypto extension" },
  { pattern: /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+set_updated_at_timestamp/gi, name: "set_updated_at_timestamp trigger function" },
];

let exitCode = 0;
let foundMigration = false;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  exitCode = 1;
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

if (!existsSync(migrationsDir)) {
  fail(`Prisma migrations directory not found: ${migrationsDir}`);
  process.exit(1);
}

const entries = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "migration_lock.toml")
  .sort()
  .reverse();

if (entries.length === 0) {
  fail("No Prisma migration SQL found - migrations directory is empty");
  process.exit(1);
}

const migrationSqlByName = entries.map((entry) => {
  const migrationFile = join(migrationsDir, entry.name, "migration.sql");

  if (!existsSync(migrationFile)) {
    fail(`migration.sql not found in ${join(migrationsDir, entry.name)}`);
    return { name: entry.name, sql: "" };
  }

  foundMigration = true;
  pass(`Found migration: ${entry.name}/migration.sql`);
  return { name: entry.name, sql: readFileSync(migrationFile, "utf-8") };
});

const combinedSql = migrationSqlByName.map((migration) => migration.sql).join("\n");

for (const { name, sql } of migrationSqlByName) {
  for (const { pattern, name: patternName } of BANNED_PATTERNS) {
    if (pattern.test(sql)) {
      fail(`${name} contains banned pattern: ${patternName} (remove from migration SQL)`);
    } else {
      pass(`${name} has no banned pattern: ${patternName}`);
    }
  }
}

for (const { pattern, name } of INIT_REQUIRED_PATTERNS) {
  if (pattern.test(combinedSql)) {
    pass(`Found required across migrations: ${name}`);
  } else {
    fail(`Missing required across migrations: ${name} (add to initial migration SQL)`);
  }
}

const tableCount = (combinedSql.match(/CREATE TABLE/gi) || []).length;
if (tableCount > 0) {
  pass(`Contains ${tableCount} CREATE TABLE statements across migrations`);
} else {
  fail("No CREATE TABLE statements found across migrations");
}

if (exitCode === 0) {
  console.log("\nAzure migration SQL checks passed.\n");
} else {
  console.log(`\n${exitCode > 1 ? `${exitCode} checks` : "1 check"} failed.\n`);
}

process.exit(exitCode);
