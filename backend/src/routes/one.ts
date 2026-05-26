/**
 * Withone integration routes.
 *
 * Exposes:
 *   POST   /api/one/auth-token        - Issue an AuthKit token for the frontend widget (dev-gated)
 *   GET    /api/one/connections       - List persisted connections for the requesting user
 *   POST   /api/one/connections       - Persist a connection after AuthKit success
 *   DELETE /api/one/connections/:key  - Revoke a persisted connection
 *   POST   /api/one/webhook           - Inbound webhook with HMAC signature verification
 */

import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { issueAuthKitToken } from "../integrations/one/auth-token";
import { applyWebhookEvent, verifyWebhook, WebhookSignatureError } from "../integrations/one/webhooks";

const SUPPORTED_PLATFORMS = new Set([
  "google-sheets",
  "google-drive",
  "google-docs",
  "gmail",
  "notion",
]);

function getUserId(req: Request): string | undefined {
  const header = req.header("x-user-id");
  if (header && header.trim().length > 0) {
    return header.trim();
  }
  return undefined;
}

function isDevTokenAllowed(req: Request): boolean {
  const expected = process.env.ONE_DEV_TOKEN;
  if (!expected || expected.trim().length === 0) return false;
  const provided = req.header("x-dev-token");
  return provided === expected;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function registerOneRoutes(app: Express, prisma: PrismaClient): void {
  app.post("/api/one/auth-token", async (req: Request, res: Response) => {
    if (isProduction() && !isDevTokenAllowed(req)) {
      res.status(403).json({ error: "auth-token endpoint requires real auth (Sprint 2)" });
      return;
    }
    if (!isProduction() && process.env.ONE_DEV_TOKEN && !isDevTokenAllowed(req)) {
      res.status(403).json({ error: "missing or invalid x-dev-token header" });
      return;
    }

    const body = isObject(req.body) ? req.body : {};
    const userId = getString(body, "userId") ?? getUserId(req);
    if (!userId) {
      res.status(400).json({ error: "userId required (body.userId or x-user-id header)" });
      return;
    }

    try {
      const identityType = (getString(body, "identityType") ?? process.env.ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE ?? "user") as
        | "user"
        | "team"
        | "organization"
        | "project";
      const token = await issueAuthKitToken({ identity: userId, identityType });
      res.status(200).json(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "auth-token issuance failed";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/one/connections", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (isProduction() && !userId) {
      res.status(401).json({ error: "x-user-id header required in production" });
      return;
    }

    const where = userId ? { user_id: userId } : {};
    const rows = await prisma.integration_connections.findMany({
      where,
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

  app.post("/api/one/connections", async (req: Request, res: Response) => {
    const body = isObject(req.body) ? req.body : {};
    const userId = getString(body, "userId") ?? getUserId(req);
    const platform = getString(body, "platform");
    const connectionKey = getString(body, "connectionKey");
    const displayName = getString(body, "displayName");
    const identityType = getString(body, "identityType") ?? process.env.ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE ?? "user";

    if (!userId) {
      res.status(400).json({ error: "userId required" });
      return;
    }
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

  app.delete("/api/one/connections/:key", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const key = req.params.key;
    if (isProduction() && !userId) {
      res.status(401).json({ error: "x-user-id header required in production" });
      return;
    }
    if (!key) {
      res.status(400).json({ error: "connection key required" });
      return;
    }

    const result = await prisma.integration_connections.deleteMany({
      where: userId ? { connection_key: key, user_id: userId } : { connection_key: key },
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
