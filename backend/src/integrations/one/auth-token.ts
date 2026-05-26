/**
 * Auth-token issuance for the withone AuthKit widget.
 *
 * Frontend AuthKit widget needs a short-lived token bound to the user's identity.
 * This module proxies POST /v1/authkit/token with our server secret.
 *
 * Until real auth lands (Sprint 2), the calling route gates this behind dev-mode
 * checks: NODE_ENV !== production AND a shared ONE_DEV_TOKEN.
 */

export interface AuthKitTokenRequest {
  identity: string;
  identityType?: "user" | "team" | "organization" | "project";
}

export interface AuthKitTokenResponse {
  token: string;
  expiresAt?: string;
}

export async function issueAuthKitToken(req: AuthKitTokenRequest): Promise<AuthKitTokenResponse> {
  const secret = process.env.ONE_SECRET_KEY;
  if (!secret) {
    throw new Error("ONE_SECRET_KEY is required to issue an AuthKit token");
  }

  const base = (process.env.ONE_API_BASE ?? "https://api.withone.ai/v1").replace(/\/+$/, "");
  const identityType = req.identityType ?? (process.env.ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE as AuthKitTokenRequest["identityType"]) ?? "user";

  const response = await fetch(`${base}/authkit/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-one-secret": secret,
    },
    body: JSON.stringify({
      identity: req.identity,
      identityType,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`withone authkit token failed (${response.status}): ${text || response.statusText}`);
  }

  const json = (await response.json()) as { token?: string; expires_at?: string; expiresAt?: string };
  if (!json.token) {
    throw new Error("withone authkit token response missing 'token' field");
  }

  return {
    token: json.token,
    expiresAt: json.expires_at ?? json.expiresAt,
  };
}
