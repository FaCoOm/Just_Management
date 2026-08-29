import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRestRepositories, type AuthGrant, type IntegrationConnection } from "@/lib/repositories";

const repos = createRestRepositories();

async function fetchConnections(): Promise<IntegrationConnection[]> {
  return repos.integrations.getConnections();
}

export function useOperatorSession() {
  return useQuery({
    queryKey: ["one", "operator-session"],
    queryFn: () => repos.integrations.getOperatorSession(),
  });
}

export function useAuthGrant(enabled = true) {
  return useQuery<AuthGrant>({
    queryKey: ["one", "auth-grant"],
    queryFn: () => repos.integrations.mintAuthGrant(),
    enabled,
    staleTime: 4 * 60_000,
    refetchInterval: 4 * 60_000,
    refetchOnWindowFocus: false,
    retry: 0,
  });
}

export function useOperatorLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => repos.integrations.loginOperator(password),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["one"] }),
  });
}

export function useOperatorLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => repos.integrations.logoutOperator(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["one"] }),
  });
}

export function useConnections(enabled = true) {
  return useQuery({
    queryKey: ["one", "connections"],
    queryFn: fetchConnections,
    staleTime: 30_000,
    enabled,
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
