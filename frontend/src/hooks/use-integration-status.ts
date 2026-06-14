import { useQuery } from "@tanstack/react-query";
import { createRestRepositories, type IntegrationStatus } from "@/lib/repositories";

const repos = createRestRepositories();

async function fetchIntegrationStatus(): Promise<IntegrationStatus> {
  return repos.integrations.getStatus();
}

export function useIntegrationStatus() {
  return useQuery({
    queryKey: ["integrations", "status"],
    queryFn: fetchIntegrationStatus,
    staleTime: 30_000,
  });
}
