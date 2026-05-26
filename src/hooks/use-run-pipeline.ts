import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { IngestSummaryResponse } from "@/hooks/use-pipeline-status";

async function runBuiltInListingsSync(): Promise<IngestSummaryResponse> {
  const response = await fetch("/api/ingest/pipeline/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "built-in",
      targetKind: "listings",
      dryRun: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Pipeline run failed: ${response.status}`);
  }

  return response.json() as Promise<IngestSummaryResponse>;
}

export function useRunPipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runBuiltInListingsSync,
    onSuccess: (summary) => {
      void queryClient.invalidateQueries({ queryKey: ["ingest", "pipeline", "status"] });

      if (summary.errors.length > 0) {
        toast.warning("Sync completed with errors", {
          description: `${summary.processed} processed, ${summary.deadLetters} dead letters.`,
        });
        return;
      }

      toast.success("Listings synced", {
        description: `${summary.processed} processed, ${summary.created} created, ${summary.updated} updated.`,
      });
    },
    onError: (error) => {
      toast.error("Sync failed", {
        description: error instanceof Error ? error.message : "Pipeline run failed.",
      });
    },
  });
}
