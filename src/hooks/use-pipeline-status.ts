import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createRestRepositories } from "@/lib/repositories";

export type {
  ConnectorStatus,
  GoogleCredentialStatus,
  IngestSummaryResponse,
  PipelineStatus,
} from "@/lib/repositories/types";

export function usePipelineStatus() {
  const repos = useMemo(() => createRestRepositories(), []);

  return useQuery({
    queryKey: ["ingest", "pipeline", "status"],
    queryFn: () => repos.ingest.getPipelineStatus(),
    staleTime: 30_000,
  });
}
