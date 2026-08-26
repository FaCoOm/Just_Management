import assert from "node:assert/strict";
import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, it } from "vitest";
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

  beforeEach(() => {
    process.env.ONE_OPERATOR_PASSWORD = "correct horse battery staple";
    process.env.ONE_SESSION_SECRET = "test-session-secret-with-enough-entropy";
    process.env.ONE_SECRET_KEY = "test-secret";
    process.env.ONE_API_BASE = "https://one.example/v1";
  });

  afterEach(async () => {
    await ts?.close();
    ts = undefined;
    delete process.env.ONE_OPERATOR_PASSWORD;
    delete process.env.ONE_SESSION_SECRET;
    delete process.env.ONE_SECRET_KEY;
    delete process.env.ONE_API_BASE;
  });

  it("rejects token issuance without an operator session", async () => {
    ts = await startTestServer();

    const res = await fetch(`${ts.baseUrl}/api/one/auth-token`, { method: "POST" });

    assert.equal(res.status, 401);
  });

  it("rejects a forged operator session", async () => {
    ts = await startTestServer();

    const res = await fetch(`${ts.baseUrl}/api/one/auth-token`, {
      method: "POST",
      headers: { Cookie: "one_operator_session=forged" },
    });

    assert.equal(res.status, 401);
  });

  it("rejects an incorrect operator password", async () => {
    ts = await startTestServer();

    const res = await fetch(`${ts.baseUrl}/api/one/operator-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });

    assert.equal(res.status, 401);
    assert.equal(res.headers.get("set-cookie"), null);
  });

  it("forwards widget pagination to WithOne", async () => {
    const originalFetch = globalThis.fetch;
    try {
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
      const login = await fetch(`${ts.baseUrl}/api/one/operator-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "correct horse battery staple" }),
      });
      const cookie = login.headers.get("set-cookie");
      assert.equal(login.status, 204);
      assert.ok(cookie?.includes("HttpOnly"));

      const res = await fetch(`${ts.baseUrl}/api/one/auth-token?page=3&limit=25`, {
        method: "POST",
        headers: { Cookie: cookie ?? "" },
        body: "{}",
      });

      assert.equal(res.status, 200);
      assert.equal(requestedUrl, "https://one.example/v1/authkit/token?page=3&limit=25");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("revokes the operator session on logout", async () => {
    ts = await startTestServer();
    const login = await fetch(`${ts.baseUrl}/api/one/operator-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "correct horse battery staple" }),
    });
    const cookie = login.headers.get("set-cookie") ?? "";

    const logout = await fetch(`${ts.baseUrl}/api/one/operator-session`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });

    assert.equal(logout.status, 204);
    assert.match(logout.headers.get("set-cookie") ?? "", /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
  });
});
