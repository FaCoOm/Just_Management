/**
 * Withone API passthrough HTTP client.
 *
 * The withone passthrough endpoint mirrors the official third-party API contract.
 * Path is the third-party API path (e.g. "/v4/spreadsheets/{id}/values:batchGet"),
 * NOT prefixed with the platform slug. Platform is identified by the connection key.
 *
 * Auth: x-one-secret (server-side bearer), x-one-connection-key (vault-issued),
 * x-one-action-id (action discriminator from search_one_platform_actions).
 */

export type PassthroughMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

export interface PassthroughOptions {
  connectionKey: string;
  actionId: string;
  method: PassthroughMethod;
  path: string;
  query?: Record<string, string | number | boolean | string[] | undefined>;
  body?: unknown;
  accept?: string;
  signal?: AbortSignal;
}

export type OneErrorLayer = "config" | "connection" | "oauth" | "upstream" | "transport";

export class OneApiError extends Error {
  readonly layer: OneErrorLayer;
  readonly status?: number;
  readonly upstreamCode?: string;
  readonly upstreamMessage?: string;

  constructor(layer: OneErrorLayer, message: string, opts: { status?: number; upstreamCode?: string; upstreamMessage?: string } = {}) {
    super(message);
    this.name = "OneApiError";
    this.layer = layer;
    this.status = opts.status;
    this.upstreamCode = opts.upstreamCode;
    this.upstreamMessage = opts.upstreamMessage;
  }

  static async fromResponse(response: Response, opts: PassthroughOptions): Promise<OneApiError> {
    let body: unknown = undefined;
    let text = "";
    try {
      text = await response.text();
      if (text.length > 0) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = text;
        }
      }
    } catch {
      // ignore body read failure
    }

    const layer = classifyLayer(response.status, body);
    const upstreamCode = extractUpstreamCode(body);
    const upstreamMessage = extractUpstreamMessage(body) ?? (text || response.statusText);
    const message = `withone passthrough ${opts.method} ${opts.path} -> ${response.status}: ${upstreamMessage}`;

    return new OneApiError(layer, message, {
      status: response.status,
      upstreamCode,
      upstreamMessage,
    });
  }
}

export class OneConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OneConfigError";
  }
}

function getOneSecret(): string {
  const secret = process.env.ONE_SECRET_KEY;
  if (!secret || secret.trim().length === 0) {
    throw new OneConfigError("ONE_SECRET_KEY env var is required for withone integration");
  }
  return secret;
}

function getOneApiBase(): string {
  const base = process.env.ONE_API_BASE ?? "https://api.withone.ai/v1";
  return base.replace(/\/+$/, "");
}

function ensureLeadingSlash(p: string): string {
  if (p.length === 0) return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

function appendQuery(url: URL, query?: PassthroughOptions["query"]): void {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        url.searchParams.append(key, String(item));
      }
      continue;
    }
    url.searchParams.append(key, String(value));
  }
}

function classifyLayer(status: number, body: unknown): OneErrorLayer {
  const code = extractUpstreamCode(body);
  if (code === "connection_invalid" || code === "connection_deleted") return "connection";
  if (code === "oauth_refresh_failed" || code === "token_expired") return "oauth";
  if (status === 401 || status === 403) return "oauth";
  if (status >= 500) return "transport";
  return "upstream";
}

function extractUpstreamCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  if (typeof record.code === "string") return record.code;
  if (typeof record.error === "object" && record.error) {
    const err = record.error as Record<string, unknown>;
    if (typeof err.status === "string") return err.status;
    if (typeof err.code === "string") return err.code;
  }
  return undefined;
}

function extractUpstreamMessage(body: unknown): string | undefined {
  if (!body) return undefined;
  if (typeof body === "string") return body;
  if (typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  if (typeof record.error === "object" && record.error) {
    const err = record.error as Record<string, unknown>;
    if (typeof err.message === "string") return err.message;
  }
  if (typeof record.error === "string") return record.error;
  return undefined;
}

export async function passthrough<T = unknown>(opts: PassthroughOptions): Promise<T> {
  const secret = getOneSecret();
  const base = getOneApiBase();
  const url = new URL(`${base}/passthrough${ensureLeadingSlash(opts.path)}`);
  appendQuery(url, opts.query);

  const headers: Record<string, string> = {
    "x-one-secret": secret,
    "x-one-connection-key": opts.connectionKey,
    "x-one-action-id": opts.actionId,
    "Accept": opts.accept ?? "application/json",
  };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (!response.ok) {
    throw await OneApiError.fromResponse(response, opts);
  }

  const accept = headers.Accept;
  if (accept.startsWith("application/json")) {
    if (response.status === 204) return undefined as unknown as T;
    return (await response.json()) as T;
  }
  return (await response.arrayBuffer()) as unknown as T;
}
