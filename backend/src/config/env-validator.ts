/**
 * Just Management - Runtime Environment Configuration Validator
 * Verifies process.env at startup and prints a clear configuration diagnostic dashboard.
 */

import fs from "node:fs";
import path from "node:path";

export interface EnvValidationReport {
  isValid: boolean;
  missingRequired: string[];
  missingRecommended: string[];
  warnings: string[];
}

export function validateEnv(): EnvValidationReport {
  const missingRequired: string[] = [];
  const missingRecommended: string[] = [];
  const warnings: string[] = [];

  console.log("\n==================================================");
  console.log("⚙️  JUST MANAGEMENT - CONFIGURATION DIAGNOSTICS");
  console.log("==================================================");

  // 1. Critical Environment Variables (Required for startup)
  if (!process.env.DATABASE_URL) {
    missingRequired.push("DATABASE_URL");
  } else {
    // Basic format validation
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl.includes("postgres.database.azure.com") && !dbUrl.includes("sslmode=require")) {
      warnings.push(
        "DATABASE_URL points to Azure PostgreSQL but is missing 'sslmode=require'. SSL is enforced by Azure Flexible Server."
      );
    }
  }

  // 2. recommended Integration Configuration (WithOne Unified API)
  if (!process.env.ONE_CONNECTION_KEY) {
    missingRecommended.push("ONE_CONNECTION_KEY");
    warnings.push(
      "ONE_CONNECTION_KEY is not configured. Endpoints checking /api/integrations/status will return a disconnected status."
    );
  }
  if (!process.env.ONE_SECRET_KEY || process.env.ONE_SECRET_KEY === "sk_live_replace_me") {
    missingRecommended.push("ONE_SECRET_KEY");
  }
  if (!process.env.ONE_WEBHOOK_SECRET || process.env.ONE_WEBHOOK_SECRET === "whsec_replace_me") {
    missingRecommended.push("ONE_WEBHOOK_SECRET");
  }

  // 3. Recommended Ingest Configuration (Google Services)
  const sheetsProvider = process.env.INGEST_SHEETS_PROVIDER || "withone";
  if (sheetsProvider === "google-sheets-direct") {
    const serviceAccountFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!serviceAccountFile) {
      missingRecommended.push("GOOGLE_SERVICE_ACCOUNT_FILE / GOOGLE_APPLICATION_CREDENTIALS");
    } else {
      const resolvedPath = path.isAbsolute(serviceAccountFile)
        ? serviceAccountFile
        : path.resolve(process.cwd(), serviceAccountFile);
      if (!fs.existsSync(resolvedPath)) {
        warnings.push(`Google Service Account File specified but file does not exist at: ${resolvedPath}`);
      }
    }

    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
      missingRecommended.push("GOOGLE_SHEETS_SPREADSHEET_ID");
    }
  }

  // 4. Print Status Dashboard
  console.log(`📡 Server Port:        ${process.env.PORT || 3001}`);
  console.log(`🔌 Database Status:    ${process.env.DATABASE_URL ? "🟢 Configured" : "🔴 MISSING"}`);
  console.log(`🔗 WithOne Keys:       ${process.env.ONE_CONNECTION_KEY ? "🟢 Configured" : "🟡 Not Set"}`);
  console.log(`📊 Ingestion Mode:     ${sheetsProvider === "google-sheets-direct" ? "Google Sheets Direct (Service Account)" : "WithOne Passthrough"}`);
  console.log(`📁 Import Directory:   ${process.env.M_MANAGEMENT_IMPORT_ROOT || process.env.M_MANAGEMENT_WATCH_DIR || "Not Active"}`);

  if (missingRequired.length > 0) {
    console.error("\n❌ FATAL CONFIGURATION ERROR:");
    console.error("The following REQUIRED variables are missing from process.env:");
    for (const reqVar of missingRequired) {
      console.error(`   - ${reqVar}`);
    }
    console.error("\n💡 SOLUTION:");
    console.error("1. Copy backend/.env.example to backend/.env");
    console.error("2. Supply a valid postgres URL in DATABASE_URL");
    console.error("3. Restart the server.");
    console.log("==================================================\n");
    return { isValid: false, missingRequired, missingRecommended, warnings };
  }

  if (missingRecommended.length > 0) {
    console.log("\n⚠️  RECOMMENDED CREDENTIALS MISSING:");
    console.log("The following keys are not set. Some integration features will run in mock mode:");
    for (const recVar of missingRecommended) {
      console.log(`   - ${recVar}`);
    }
  }

  if (warnings.length > 0) {
    console.log("\nℹ️  CONFIGURATION WARNINGS:");
    for (const warn of warnings) {
      console.log(`   - ${warn}`);
    }
  }

  console.log("\n🚀 Configuration validation passed successfully.");
  console.log("==================================================\n");

  return { isValid: true, missingRequired, missingRecommended, warnings };
}
