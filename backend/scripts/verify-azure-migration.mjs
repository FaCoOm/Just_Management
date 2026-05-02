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

const REQUIRED_PATTERNS = [
  { pattern: /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pgcrypto/gi, name: "pgcrypto extension", optional: false },
  { pattern: /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+set_updated_at_timestamp/gi, name: "set_updated_at_timestamp trigger function", optional: false },
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

// Find the most recent migration directory
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

const latestMigrationDir = join(migrationsDir, entries[0].name);
const migrationFile = join(latestMigrationDir, "migration.sql");

if (!existsSync(migrationFile)) {
  fail(`migration.sql not found in ${latestMigrationDir}`);
  process.exit(1);
}

foundMigration = true;
pass(`Found migration: ${entries[0].name}/migration.sql`);

const sql = readFileSync(migrationFile, "utf-8");

// Check for banned patterns (Supabase-only syntax)
for (const { pattern, name } of BANNED_PATTERNS) {
  if (pattern.test(sql)) {
    fail(`Contains banned pattern: ${name} (remove from migration SQL)`);
  } else {
    pass(`No banned pattern: ${name}`);
  }
}

// Check for required patterns
for (const { pattern, name, optional } of REQUIRED_PATTERNS) {
  if (pattern.test(sql)) {
    pass(`Found required: ${name}`);
  } else if (optional) {
    console.log(`INFO: Optional pattern not found: ${name}`);
  } else {
    fail(`Missing required: ${name} (add to migration SQL)`);
  }
}

// Check that the migration has table DDL (basic sanity)
const tableCount = (sql.match(/CREATE TABLE/gi) || []).length;
if (tableCount > 0) {
  pass(`Contains ${tableCount} CREATE TABLE statements`);
} else {
  fail("No CREATE TABLE statements found in migration");
}

if (exitCode === 0) {
  console.log("\nAzure migration SQL checks passed.\n");
} else {
  console.log(`\n${exitCode > 1 ? `${exitCode} checks` : "1 check"} failed.\n`);
}

process.exit(exitCode);