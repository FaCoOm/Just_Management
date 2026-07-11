import assert from "node:assert/strict";
import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, it } from "vitest";
import { registerOneRoutes } from "../src/routes/one.js";

interface TestServer {
  baseUrl: string;
  close(): Promise<void>;
}

async function startTestServer(): Promise<TestServer> {
  const app: Express = express();
  app.use(express.json());
  registerOneRoutes(app, { integration_connections: {} } as never);

  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

describe("POST /api/one/auth-token", () => {
  let ts: TestServer | undefined;

  afterEach(async () => {
    await ts?.close();
    ts = undefined;
  });

  it("forwards widget pagination to WithOne", async () => {
    const originalFetch = globalThis.fetch;
    const originalSecret = process.env.ONE_SECRET_KEY;
    const originalBase = process.env.ONE_API_BASE;

    try {
      process.env.ONE_SECRET_KEY = "test-secret";
      process.env.ONE_API_BASE = "https://one.example/v1";
      let requestedUrl = "";

      globalThis.fetch = async (url, init) => {
        requestedUrl = url.toString();
        if (!requestedUrl.startsWith("https://one.example/")) {
          return originalFetch(url, init);
        }
        return new Response(JSON.stringify({ rows: [], total: 0, pages: 0, page: 3, requestId: "req-3" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      ts = await startTestServer();
      const res = await fetch(`${ts.baseUrl}/api/one/auth-token?page=3&limit=25`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": "dev-admin-1" },
        body: "{}",
      });

      assert.equal(res.status, 200);
      assert.equal(requestedUrl, "https://one.example/v1/authkit/token?page=3&limit=25");
    } finally {
      globalThis.fetch = originalFetch;
      process.env.ONE_SECRET_KEY = originalSecret;
      process.env.ONE_API_BASE = originalBase;
    }
  });
});
