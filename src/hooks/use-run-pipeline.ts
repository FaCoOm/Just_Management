import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createRestRepositories } from "@/lib/repositories";

export function useRunPipeline() {
  const queryClient = useQueryClient();
  const repos = useMemo(() => createRestRepositories(), []);

  return useMutation({
    mutationFn: () => repos.ingest.runBuiltInListingsSync(),
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
