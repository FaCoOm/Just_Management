/**
 * Withone connection vault wrapper.
 *
 * Persisted connection metadata lives in integration_connections (Postgres).
 * Live vault state is queried directly via withone passthrough vault APIs.
 */

import { passthrough } from "./client";

export interface OneConnectionSummary {
  connectionKey: string;
  platform: string;
  status: string;
  identity?: string;
  identityType?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface VaultListResponse {
  connections?: Array<{
    key?: string;
    platform?: string;
    status?: string;
    identity?: string;
    identity_type?: string;
    created_at?: string;
    updated_at?: string;
  }>;
}

/**
 * List connections in the withone vault for a given identity.
 * Identity defaults to the env-configured identity type.
 */
export async function listVaultConnections(identity: string, identityType?: string): Promise<OneConnectionSummary[]> {
  const data = await passthrough<VaultListResponse>({
    connectionKey: "system",
    actionId: "vault.list",
    method: "GET",
    path: "/vault/connections",
    query: { identity, identity_type: identityType ?? process.env.ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE ?? "user" },
  });

  const rows = data.connections ?? [];
  return rows
    .filter((r): r is { key: string } & typeof r => typeof r.key === "string" && r.key.length > 0)
    .map((r) => ({
      connectionKey: r.key,
      platform: r.platform ?? "unknown",
      status: r.status ?? "unknown",
      identity: r.identity,
      identityType: r.identity_type,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
}

export async function deleteVaultConnection(connectionKey: string): Promise<void> {
  await passthrough<unknown>({
    connectionKey: "system",
    actionId: "vault.delete",
    method: "DELETE",
    path: `/vault/connections/${encodeURIComponent(connectionKey)}`,
  });
}
