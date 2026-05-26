/**
 * Withone webhook handler.
 *
 * Verifies HMAC signature on inbound webhook requests and dispatches recognized
 * events to integration_connections state updates. Heavy work runs via setImmediate
 * so we respond within the 5s acknowledgement window.
 */

import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export interface WebhookEnvelope {
  type?: string;
  data?: {
    connectionKey?: string;
    connection_key?: string;
    error?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface VerifyWebhookOptions {
  rawBody: Buffer;
  signatureHeader: string | undefined;
  secret: string | undefined;
}

export interface VerifiedWebhook {
  envelope: WebhookEnvelope;
  rawBody: Buffer;
}

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export function verifyWebhook(opts: VerifyWebhookOptions): VerifiedWebhook {
  if (!opts.secret) {
    throw new WebhookSignatureError("ONE_WEBHOOK_SECRET is not configured");
  }
  if (!opts.signatureHeader) {
    throw new WebhookSignatureError("missing X-Withone-Signature header");
  }

  const expected = crypto
    .createHmac("sha256", opts.secret)
    .update(opts.rawBody)
    .digest("hex");

  const provided = opts.signatureHeader.startsWith("sha256=")
    ? opts.signatureHeader.slice(7)
    : opts.signatureHeader;

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) {
    throw new WebhookSignatureError("signature length mismatch");
  }
  if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    throw new WebhookSignatureError("signature mismatch");
  }

  let envelope: WebhookEnvelope;
  try {
    envelope = JSON.parse(opts.rawBody.toString("utf8")) as WebhookEnvelope;
  } catch (err) {
    throw new WebhookSignatureError(`invalid JSON body: ${(err as Error).message}`);
  }

  return { envelope, rawBody: opts.rawBody };
}

export async function applyWebhookEvent(prisma: PrismaClient, event: WebhookEnvelope): Promise<void> {
  const type = event.type ?? "";
  const connectionKey = event.data?.connectionKey ?? event.data?.connection_key;
  if (!connectionKey || typeof connectionKey !== "string") {
    return;
  }

  if (type === "connection.deleted") {
    await prisma.integration_connections.updateMany({
      where: { connection_key: connectionKey },
      data: { status: "revoked", updated_at: new Date() },
    });
    return;
  }

  if (type === "oauth.failed") {
    const errorMessage = typeof event.data?.error === "string" ? event.data.error : "oauth refresh failed";
    await prisma.integration_connections.updateMany({
      where: { connection_key: connectionKey },
      data: { status: "failed_refresh", last_error: errorMessage, updated_at: new Date() },
    });
    return;
  }

  if (type === "oauth.refreshed") {
    await prisma.integration_connections.updateMany({
      where: { connection_key: connectionKey },
      data: { status: "active", last_error: null, updated_at: new Date() },
    });
    return;
  }

  // passthrough.executed and unknown events are ignored intentionally.
}
