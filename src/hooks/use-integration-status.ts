import { useQuery } from "@tanstack/react-query";

export interface IntegrationStatus {
  status: "connected" | "disconnected";
  provider: "withone";
  error?: string;
}

async function fetchIntegrationStatus(): Promise<IntegrationStatus> {
  const response = await fetch("/api/integrations/status");
  if (!response.ok) throw new Error(`Integration status failed: ${response.status}`);
  return response.json() as Promise<IntegrationStatus>;
}

export function useIntegrationStatus() {
  return useQuery({
    queryKey: ["integrations", "status"],
    queryFn: fetchIntegrationStatus,
    staleTime: 30_000,
  });
}
