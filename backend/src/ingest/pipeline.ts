import fs from "node:fs";
import path from "node:path";

export const pipelineModes = ["admin-upload", "folder-watch", "email", "built-in", "google-sheets"] as const;
export type PipelineMode = (typeof pipelineModes)[number];

export const pipelineTargetKinds = ["listings", "reservations"] as const;
export type PipelineTargetKind = (typeof pipelineTargetKinds)[number];

export interface ConnectorStatus {
  mode: PipelineMode;
  enabled: boolean;
  state: "ready" | "not_configured" | "planned" | "missing_path";
  detail: string;
  path?: string;
}

export interface GoogleCredentialStatus {
  configured: boolean;
  envVar?: "GOOGLE_SERVICE_ACCOUNT_FILE" | "GOOGLE_APPLICATION_CREDENTIALS";
  readable: boolean;
  path?: string;
  clientEmail?: string;
  projectId?: string;
  credentialType?: string;
}

export interface PipelineStatus {
  enabled: boolean;
  phase: "scaffolded";
  connectors: ConnectorStatus[];
  googleCredentials: GoogleCredentialStatus;
}

interface ServiceAccountMetadata {
  client_email?: unknown;
  project_id?: unknown;
  type?: unknown;
}

function envFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function resolveOptionalPath(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) return undefined;
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function fileExists(filePath: string | undefined): boolean {
  return Boolean(filePath) && fs.existsSync(filePath as string) && fs.statSync(filePath as string).isFile();
}

function directoryExists(directoryPath: string | undefined): boolean {
  return Boolean(directoryPath) && fs.existsSync(directoryPath as string) && fs.statSync(directoryPath as string).isDirectory();
}

function readServiceAccountMetadata(filePath: string): Pick<GoogleCredentialStatus, "clientEmail" | "projectId" | "credentialType"> {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as ServiceAccountMetadata;

  return {
    clientEmail: typeof parsed.client_email === "string" ? parsed.client_email : undefined,
    projectId: typeof parsed.project_id === "string" ? parsed.project_id : undefined,
    credentialType: typeof parsed.type === "string" ? parsed.type : undefined,
  };
}

export function getGoogleCredentialStatus(): GoogleCredentialStatus {
  const preferredPath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const fallbackPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const envVar = preferredPath ? "GOOGLE_SERVICE_ACCOUNT_FILE" : fallbackPath ? "GOOGLE_APPLICATION_CREDENTIALS" : undefined;
  const resolvedPath = resolveOptionalPath(preferredPath ?? fallbackPath);

  if (!envVar || !resolvedPath) {
    return { configured: false, readable: false };
  }

  if (!fileExists(resolvedPath)) {
    return { configured: true, envVar, readable: false, path: resolvedPath };
  }

  try {
    return {
      configured: true,
      envVar,
      readable: true,
      path: resolvedPath,
      ...readServiceAccountMetadata(resolvedPath),
    };
  } catch {
    return { configured: true, envVar, readable: false, path: resolvedPath };
  }
}

export function getPipelineStatus(): PipelineStatus {
  const enabled = envFlag("INGEST_PIPELINE_ENABLED", true);
  const watchDirectory = resolveOptionalPath(process.env.M_MANAGEMENT_WATCH_DIR);
  const builtInDirectory = resolveOptionalPath(process.env.M_MANAGEMENT_BUILTIN_SOURCE_DIR ?? "../database_design");
  const emailEnabled = envFlag("M_MANAGEMENT_EMAIL_IMPORT_ENABLED", false);
  const emailProvider = process.env.M_MANAGEMENT_EMAIL_IMPORT_PROVIDER ?? "not configured";
  const googleCredentials = getGoogleCredentialStatus();

  return {
    enabled,
    phase: "scaffolded",
    connectors: [
      {
        mode: "admin-upload",
        enabled,
        state: "ready",
        detail: "Existing multipart ingest endpoints remain active for admin UI integration.",
      },
      {
        mode: "folder-watch",
        enabled: enabled && Boolean(watchDirectory),
        state: watchDirectory ? (directoryExists(watchDirectory) ? "ready" : "missing_path") : "not_configured",
        detail: "Folder watcher records file changes; pipeline/run executes selected files through the ingest services.",
        path: watchDirectory,
      },
      {
        mode: "email",
        enabled: enabled && emailEnabled,
        state: emailEnabled ? "planned" : "not_configured",
        detail: `Email attachment sync is executable via withone Gmail; provider=${emailProvider}.`,
      },
      {
        mode: "built-in",
        enabled,
        state: directoryExists(builtInDirectory) ? "ready" : "missing_path",
        detail: "Built-in database_design import is executable through pipeline/run.",
        path: builtInDirectory,
      },
      {
        mode: "google-sheets",
        enabled: enabled && googleCredentials.configured,
        state: googleCredentials.configured ? (googleCredentials.readable ? "ready" : "missing_path") : "not_configured",
        detail: "Google Sheets connector supports service-account access or withone passthrough via INGEST_SHEETS_PROVIDER.",
      },
    ],
    googleCredentials,
  };
}

export function isPipelineMode(value: string): value is PipelineMode {
  return pipelineModes.includes(value as PipelineMode);
}

export function isPipelineTargetKind(value: string): value is PipelineTargetKind {
  return pipelineTargetKinds.includes(value as PipelineTargetKind);
}
