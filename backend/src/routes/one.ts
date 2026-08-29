/**
 * Withone integration routes.
 *
 * Exposes:
 *   POST   /api/one/auth-grant        - Mint a short-lived signed grant (operator-cookie gated)
 *   POST   /api/one/auth-token        - Issue an AuthKit token using a valid grant (header gated)
 *   GET    /api/one/connections       - List persisted connections for the requesting user
 *   POST   /api/one/connections       - Persist a connection after AuthKit success
 *   DELETE /api/one/connections/:key  - Revoke a persisted connection
 *   POST   /api/one/webhook           - Inbound webhook with HMAC signature verification
 */

import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";
import { issueAuthKitToken } from "../integrations/one/auth-token";
import { applyWebhookEvent, verifyWebhook, WebhookSignatureError } from "../integrations/one/webhooks";

const SUPPORTED_PLATFORMS = new Set([
  "google-sheets",
  "google-drive",
  "google-docs",
  "gmail",
  "notion",
]);

const SESSION_COOKIE = "one_operator_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

const GRANT_HEADER = "x-one-grant";
const GRANT_TTL_MS = 5 * 60 * 1000;

type IdentityType = "user" | "team" | "organization" | "project";

type AuthGrantPayload = {
  identity: string;
  identityType: IdentityType;
  exp: number;
};

function operatorIdentity(): string {
  return process.env.ONE_OPERATOR_IDENTITY?.trim() || "operator";
}

function signGrant(payload: AuthGrantPayload): string | undefined {
  const secret = process.env.ONE_SESSION_SECRET;
  if (!secret) return undefined;
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyGrant(grant: string | undefined): AuthGrantPayload | null {
  const secret = process.env.ONE_SESSION_SECRET;
  if (!secret || !grant) return null;
  const separator = grant.lastIndexOf(".");
  if (separator < 1) return null;
  const body = grant.slice(0, separator);
  const signature = grant.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (signatureBytes.length !== expectedBytes.length) return null;
  if (!timingSafeEqual(signatureBytes, expectedBytes)) return null;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!isObject(decoded)) return null;
    const payload = decoded as Record<string, unknown>;
    if (typeof payload.exp !== "number" || !Number.isSafeInteger(payload.exp) || payload.exp <= Date.now()) {
      return null;
    }
    if (typeof payload.identity !== "string" || payload.identity.length === 0) return null;
    const identityType = payload.identityType;
    if (identityType !== "user" && identityType !== "team" && identityType !== "organization" && identityType !== "project") {
      return null;
    }
    return { identity: payload.identity, identityType, exp: payload.exp };
  } catch {
    return null;
  }
}

function signSession(expiresAt: number): string | undefined {
  const secret = process.env.ONE_SESSION_SECRET;
  if (!secret) return undefined;
  const payload = String(expiresAt);
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function hasOperatorSession(req: Request): boolean {
  const cookie = req.header("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!cookie) return false;
  const separator = cookie.indexOf(".");
  const expiresAt = Number(cookie.slice(0, separator));
  const expected = signSession(expiresAt);
  if (separator < 1 || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || !expected) return false;
  const expectedBytes = Buffer.from(expected);
  const cookieBytes = Buffer.from(cookie);
  return expectedBytes.length === cookieBytes.length && timingSafeEqual(expectedBytes, cookieBytes);
}

function requireOperatorSession(req: Request, res: Response, next: NextFunction): void {
  if (!hasOperatorSession(req)) {
    res.status(401).json({ error: "operator session required" });
    return;
  }
  next();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function registerOneRoutes(app: Express, prisma: PrismaClient): void {
  app.get("/api/one/operator-session", (req: Request, res: Response) => {
    res.status(200).json({ authenticated: hasOperatorSession(req) });
  });

  app.post("/api/one/operator-session", (req: Request, res: Response) => {
    const body = isObject(req.body) ? req.body : {};
    const password = getString(body, "password")?.trim();
    const expected = process.env.ONE_OPERATOR_PASSWORD?.trim();
    const sessionSecret = process.env.ONE_SESSION_SECRET?.trim();
    if (!expected || !sessionSecret || !password) {
      res.status(401).json({ error: "invalid operator credentials" });
      return;
    }
    const expectedBytes = createHmac("sha256", sessionSecret).update(expected).digest();
    const passwordBytes = createHmac("sha256", sessionSecret).update(password).digest();
    if (!timingSafeEqual(expectedBytes, passwordBytes)) {
      res.status(401).json({ error: "invalid operator credentials" });
      return;
    }
    const value = signSession(Date.now() + SESSION_DURATION_MS);
    if (!value) {
      res.status(500).json({ error: "operator session unavailable" });
      return;
    }
    const isHttps = req.secure || req.header("x-forwarded-proto") === "https" || process.env.NODE_ENV === "production";
    res.cookie(SESSION_COOKIE, value, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: SESSION_DURATION_MS,
      path: "/",
    });
    res.sendStatus(204);
  });

  app.delete("/api/one/operator-session", (req: Request, res: Response) => {
    const isHttps = req.secure || req.header("x-forwarded-proto") === "https" || process.env.NODE_ENV === "production";
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
    });
    res.sendStatus(204);
  });

  app.post("/api/one/auth-grant", requireOperatorSession, (_req: Request, res: Response) => {
    const identityType = (process.env.ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE ?? "user") as IdentityType;
    const exp = Date.now() + GRANT_TTL_MS;
    const grant = signGrant({ identity: operatorIdentity(), identityType, exp });
    if (!grant) {
      res.status(500).json({ error: "auth grant unavailable" });
      return;
    }
    res.status(200).json({ grant, expiresAt: exp });
  });

  app.post("/api/one/auth-token", async (req: Request, res: Response) => {
    const grantHeader = req.header(GRANT_HEADER);
    if (!grantHeader) {
      res.status(401).json({ error: "auth grant required" });
      return;
    }
    const verified = verifyGrant(grantHeader);
    if (!verified) {
      res.status(401).json({ error: "invalid or expired auth grant" });
      return;
    }
    try {
      const identityType = verified.identityType;
      const page = typeof req.query.page === "string" ? req.query.page : "1";
      const limit = typeof req.query.limit === "string" ? req.query.limit : "100";
      const token = await issueAuthKitToken({ identity: verified.identity, identityType, page, limit });
      res.status(200).json(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "auth-token issuance failed";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/one/connections", requireOperatorSession, async (_req: Request, res: Response) => {
    const rows = await prisma.integration_connections.findMany({
      where: { user_id: operatorIdentity() },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        user_id: true,
        platform: true,
        connection_key: true,
        display_name: true,
        environment: true,
        status: true,
        last_used_at: true,
        last_error: true,
        created_at: true,
        updated_at: true,
      },
    });
    res.status(200).json({ connections: rows });
  });

  app.post("/api/one/connections", requireOperatorSession, async (req: Request, res: Response) => {
    const body = isObject(req.body) ? req.body : {};
    const userId = operatorIdentity();
    const platform = getString(body, "platform");
    const connectionKey = getString(body, "connectionKey");
    const displayName = getString(body, "displayName");
    const identityType = getString(body, "identityType") ?? process.env.ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE ?? "user";

    if (!platform || !SUPPORTED_PLATFORMS.has(platform)) {
      res.status(400).json({ error: `platform must be one of: ${Array.from(SUPPORTED_PLATFORMS).join(", ")}` });
      return;
    }
    if (!connectionKey) {
      res.status(400).json({ error: "connectionKey required" });
      return;
    }

    try {
      const row = await prisma.integration_connections.upsert({
        where: { connection_key: connectionKey },
        create: {
          user_id: userId,
          identity_type: identityType,
          platform,
          connection_key: connectionKey,
          display_name: displayName ?? null,
          environment: connectionKey.startsWith("test::") ? "test" : "live",
          status: "active",
          metadata: {},
        },
        update: {
          user_id: userId,
          identity_type: identityType,
          platform,
          display_name: displayName ?? null,
          status: "active",
          last_error: null,
          updated_at: new Date(),
        },
      });
      res.status(200).json({ connection: row });
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to persist connection";
      res.status(500).json({ error: message });
    }
  });

  app.delete("/api/one/connections/:key", requireOperatorSession, async (req: Request, res: Response) => {
    const userId = operatorIdentity();
    const key = req.params.key;
    if (!key) {
      res.status(400).json({ error: "connection key required" });
      return;
    }

    const result = await prisma.integration_connections.deleteMany({
      where: { connection_key: key, user_id: userId },
    });
    res.status(200).json({ deleted: result.count });
  });

  // Webhook MUST receive raw body for HMAC verification.
  app.post(
    "/api/one/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req: Request, res: Response, _next: NextFunction) => {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
      try {
        const verified = verifyWebhook({
          rawBody,
          signatureHeader: req.header("x-withone-signature") ?? req.header("X-Withone-Signature"),
          secret: process.env.ONE_WEBHOOK_SECRET,
        });
        // Acknowledge first, do work async.
        res.status(200).json({ accepted: true });
        setImmediate(() => {
          applyWebhookEvent(prisma, verified.envelope).catch((err) => {
            console.error("withone webhook apply failed:", err instanceof Error ? err.message : err);
          });
        });
      } catch (err) {
        if (err instanceof WebhookSignatureError) {
          res.status(401).json({ error: err.message });
          return;
        }
        const message = err instanceof Error ? err.message : "webhook processing failed";
        res.status(500).json({ error: message });
      }
    },
  );
}
