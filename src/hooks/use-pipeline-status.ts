import { useQuery } from "@tanstack/react-query";

export interface ConnectorStatus {
  mode: "admin-upload" | "folder-watch" | "email" | "built-in" | "google-sheets";
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

export interface IngestSummaryResponse {
  syncRunId: string;
  dryRun: boolean;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  deadLetters: number;
  errors: Array<{ code: string; message: string; field?: string }>;
}

async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const response = await fetch("/api/ingest/pipeline/status");
  if (!response.ok) throw new Error(`Pipeline status failed: ${response.status}`);
  return response.json() as Promise<PipelineStatus>;
}

export function usePipelineStatus() {
  return useQuery({
    queryKey: ["ingest", "pipeline", "status"],
    queryFn: fetchPipelineStatus,
    staleTime: 30_000,
  });
}