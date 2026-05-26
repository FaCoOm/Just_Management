import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface IntegrationConnection {
  id: string;
  user_id: string;
  platform: string;
  connection_key: string;
  display_name: string | null;
  environment: string;
  status: string;
  last_used_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface ConnectionsResponse {
  connections: IntegrationConnection[];
}

const USER_ID = "dev-admin-1";

async function fetchConnections(): Promise<IntegrationConnection[]> {
  const response = await fetch("/api/one/connections", { headers: { "x-user-id": USER_ID } });
  if (!response.ok) throw new Error(`Connections failed: ${response.status}`);
  const data = (await response.json()) as ConnectionsResponse;
  return data.connections;
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
    mutationFn: async (payload: { platform: string; connectionKey: string; displayName?: string }) => {
      const response = await fetch("/api/one/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": USER_ID },
        body: JSON.stringify({ userId: USER_ID, identityType: "user", ...payload }),
      });
      if (!response.ok) throw new Error(`Persist connection failed: ${response.status}`);
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["one", "connections"] }),
  });
}

export function useDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (connectionKey: string) => {
      const response = await fetch(`/api/one/connections/${encodeURIComponent(connectionKey)}`, {
        method: "DELETE",
        headers: { "x-user-id": USER_ID },
      });
      if (!response.ok) throw new Error(`Disconnect failed: ${response.status}`);
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["one", "connections"] }),
  });
}