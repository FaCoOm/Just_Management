import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRestRepositories, type IntegrationConnection } from "@/lib/repositories";

const repos = createRestRepositories();

async function fetchConnections(): Promise<IntegrationConnection[]> {
  return repos.integrations.getConnections();
}

export function useConnections() {
  return useQuery({
    queryKey: ["one", "connections"],
    queryFn: fetchConnections,
    staleTime: 30_000,
  });
}

export function usePersistConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { platform: string; connectionKey: string; displayName?: string }) => repos.integrations.persistConnection(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["one", "connections"] }),
  });
}

export function useDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionKey: string) => repos.integrations.disconnect(connectionKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["one", "connections"] }),
  });
}
