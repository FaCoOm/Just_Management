import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createEmptyIngestSummary, type IngestSummaryResponse } from "../contracts";

const prisma = new PrismaClient();

const ACCOUNT_KEYS: Record<string, string> = {
  Mujo: "airbnb-main",
  Ruby: "airbnb-ruby",
  Manuka: "airbnb-manuka22",
};

const OWNER_KEYS: Record<string, string> = {
  Mujo: "mujo",
  Ruby: "ruby",
  Manuka: "manuka",
};

interface ClassificationListing {
  id?: unknown;
  canonicalAccount?: unknown;
  visibilityTier?: unknown;
  visibleInAccounts?: unknown;
  title?: unknown;
  internalName?: unknown;
  statusByAccount?: Record<string, unknown>;
  sourceRows?: Record<string, unknown>;
}

interface ClassificationFile {
  listings?: ClassificationListing[];
}

function resolveSourceDir(sourceDir?: string): string {
  const configured = sourceDir ?? process.env.M_MANAGEMENT_BUILTIN_SOURCE_DIR ?? "../database_design";
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

function manifestPath(sourceDir: string): string {
  return path.join(sourceDir, "listing-account-classification.json");
}

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStatus(value: unknown): string {
  const raw = stringValue(value).toLowerCase();
  if (raw === "listed" || raw === "da dang" || raw === "đã đăng") return "listed";
  if (raw === "in progress") return "in_progress";
  if (raw === "unlisted") return "unlisted";
  return raw || "unknown";
}

function sourceRowObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function sourceRowString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function sourceRowDate(row: Record<string, unknown>): Date | null {
  const raw = sourceRowString(row, "Extracted At");
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readClassification(sourceDir: string): { manifest: ClassificationFile; hash: string } {
  const buffer = fs.readFileSync(manifestPath(sourceDir));
  return { manifest: JSON.parse(buffer.toString("utf8")) as ClassificationFile, hash: sha256(buffer) };
}

function addInto(target: IngestSummaryResponse, child: Partial<IngestSummaryResponse>): void {
  target.processed += child.processed ?? 0;
  target.created += child.created ?? 0;
  target.updated += child.updated ?? 0;
  target.skipped += child.skipped ?? 0;
  target.deadLetters += child.deadLetters ?? 0;
  if (child.errors) target.errors.push(...child.errors);
}

export async function processBuiltInSeed(sourceDirInput: string | undefined, isDryRun: boolean): Promise<IngestSummaryResponse> {
  const summary = createEmptyIngestSummary("listings", isDryRun);
  const sourceDir = resolveSourceDir(sourceDirInput);

  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    summary.errors.push({ code: "UNSUPPORTED_SOURCE", field: "sourceDir", message: `Built-in source directory not found: ${sourceDir}` });
    return summary;
  }

  let parsed: { manifest: ClassificationFile; hash: string };
  try {
    parsed = readClassification(sourceDir);
  } catch (err) {
    summary.errors.push({ code: "MALFORMED_FILE", field: "manifest", message: err instanceof Error ? err.message : "Could not read classification manifest" });
    return summary;
  }

  const listings = parsed.manifest.listings ?? [];
  summary.processed = listings.length;

  if (!isDryRun) {
    const existing = await prisma.seed_batches.findFirst({ where: { source_dir: sourceDir, manifest_sha256: parsed.hash, status: "completed" } });
    if (existing) {
      summary.skipped = listings.length;
      return summary;
    }
  }

  let syncRunId = summary.syncRunId;
  if (!isDryRun) {
    const syncRun = await prisma.sync_runs.create({
      data: {
        source_type: "built-in",
        endpoint: "/api/ingest/pipeline/run",
        is_dry_run: false,
        config_snapshot: { sourceDir, manifestSha256: parsed.hash },
      },
    });
    syncRunId = syncRun.id;
    summary.syncRunId = syncRunId;
  }

  try {
    if (!isDryRun) {
      const channel = await prisma.channels.upsert({
        where: { slug: "airbnb" },
        update: { display_name: "Airbnb" },
        create: { slug: "airbnb", display_name: "Airbnb" },
      });

      const accounts: Record<string, { id: string }> = {};
      for (const [label, accountKey] of Object.entries(ACCOUNT_KEYS)) {
        const account = await prisma.external_accounts.upsert({
          where: { channel_id_account_key: { channel_id: channel.id, account_key: accountKey } },
          update: { display_name: label, last_sync_started_at: new Date() },
          create: { channel_id: channel.id, account_key: accountKey, display_name: label },
        });
        accounts[label] = { id: account.id };
      }

      for (const listing of listings) {
        const providerListingId = stringValue(listing.id);
        const title = stringValue(listing.title);
        const internalName = stringValue(listing.internalName);
        const visibleIn = Array.isArray(listing.visibleInAccounts) ? listing.visibleInAccounts.map(stringValue).filter(Boolean) : [];

        if (!providerListingId || !title || visibleIn.length === 0) {
          await prisma.sync_dead_letters.create({
            data: {
              sync_run_id: syncRunId,
              source_file: manifestPath(sourceDir),
              failure_code: "AMBIGUOUS_LISTING_MATCH",
              failure_reason: "listing missing id, title, or visibleInAccounts",
              normalized_payload: listing as object,
            },
          });
          summary.deadLetters += 1;
          continue;
        }

        const ownerLabel = visibleIn.includes("Manuka") ? "Manuka" : visibleIn.includes("Ruby") ? "Ruby" : "Mujo";
        const owner = OWNER_KEYS[ownerLabel] ?? "mujo";
        const account = accounts.Mujo;
        const row = sourceRowObject(listing.sourceRows?.Mujo);
        const before = await prisma.channel_listings.findUnique({
          where: { provider_listing_id: providerListingId },
          select: { id: true },
        });

        await prisma.channel_listings.upsert({
          where: { provider_listing_id: providerListingId },
          update: {
            external_account_id: account.id,
            owner,
            title,
            internal_name: internalName,
            listing_type: sourceRowString(row, "Type") ?? "home",
            location: sourceRowString(row, "Location") ?? "",
            status: normalizeStatus(listing.statusByAccount?.Mujo),
            public_url: sourceRowString(row, "Public URL"),
            host_editor_url: sourceRowString(row, "Host Editor URL"),
            extracted_at: sourceRowDate(row),
            last_seen_at: new Date(),
            last_synced_at: new Date(),
            source_metadata: { canonicalAccount: stringValue(listing.canonicalAccount), visibilityTier: stringValue(listing.visibilityTier), visibleInAccounts: visibleIn },
          },
          create: {
            external_account_id: account.id,
            provider_listing_id: providerListingId,
            owner,
            title,
            internal_name: internalName,
            listing_type: sourceRowString(row, "Type") ?? "home",
            location: sourceRowString(row, "Location") ?? "",
            status: normalizeStatus(listing.statusByAccount?.Mujo),
            public_url: sourceRowString(row, "Public URL"),
            host_editor_url: sourceRowString(row, "Host Editor URL"),
            extracted_at: sourceRowDate(row),
            last_seen_at: new Date(),
            last_synced_at: new Date(),
            source_metadata: { canonicalAccount: stringValue(listing.canonicalAccount), visibilityTier: stringValue(listing.visibilityTier), visibleInAccounts: visibleIn },
          },
        });

        if (before) summary.updated += 1;
        else summary.created += 1;
      }

      await prisma.sync_runs.update({
        where: { id: syncRunId },
        data: {
          status: summary.errors.length > 0 ? "completed_with_errors" : "completed",
          processed_count: summary.processed,
          created_count: summary.created,
          updated_count: summary.updated,
          skipped_count: summary.skipped,
          dead_letter_count: summary.deadLetters,
          finished_at: new Date(),
        },
      });
      await prisma.seed_batches.create({ data: { source_dir: sourceDir, manifest_sha256: parsed.hash, status: "completed", sync_run_id: syncRunId } });
    } else {
      addInto(summary, { skipped: 0 });
    }
  } catch (err) {
    if (!isDryRun && syncRunId) {
      await prisma.sync_runs.update({ where: { id: syncRunId }, data: { status: "failed", finished_at: new Date() } }).catch(() => undefined);
    }
    summary.errors.push({ code: "MALFORMED_FILE", message: err instanceof Error ? err.message : "Built-in seed failed" });
  }

  return summary;
}
