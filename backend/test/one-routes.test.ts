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

      const grantRes = await fetch(`${ts.baseUrl}/api/one/auth-grant`, {
        method: "POST",
        headers: { Cookie: cookie ?? "" },
      });
      const { grant } = (await grantRes.json()) as { grant: string };

      const res = await fetch(`${ts.baseUrl}/api/one/auth-token?page=3&limit=25`, {
        method: "POST",
        headers: { Cookie: cookie ?? "", "Content-Type": "application/json", "x-one-grant": grant },
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

describe("POST /api/one/auth-grant", () => {
  let ts: TestServer | undefined;

  beforeEach(() => {
    process.env.ONE_OPERATOR_PASSWORD = "correct horse battery staple";
    process.env.ONE_SESSION_SECRET = "test-session-secret-with-enough-entropy";
    process.env.ONE_SECRET_KEY = "test-secret";
    process.env.ONE_API_BASE = "https://one.example/v1";
    process.env.ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE = "user";
  });

  afterEach(async () => {
    await ts?.close();
    ts = undefined;
    delete process.env.ONE_OPERATOR_PASSWORD;
    delete process.env.ONE_SESSION_SECRET;
    delete process.env.ONE_SECRET_KEY;
    delete process.env.ONE_API_BASE;
    delete process.env.ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE;
  });

  async function loginForGrant(): Promise<string> {
    ts = await startTestServer();
    const login = await fetch(`${ts.baseUrl}/api/one/operator-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "correct horse battery staple" }),
    });
    return login.headers.get("set-cookie") ?? "";
  }

  it("rejects unauthenticated grant requests", async () => {
    ts = await startTestServer();
    const res = await fetch(`${ts.baseUrl}/api/one/auth-grant`, { method: "POST" });
    assert.equal(res.status, 401);
  });

  it("rejects grant requests with a forged operator session cookie", async () => {
    ts = await startTestServer();
    const res = await fetch(`${ts.baseUrl}/api/one/auth-grant`, {
      method: "POST",
      headers: { Cookie: "one_operator_session=forged" },
    });
    assert.equal(res.status, 401);
  });

  it("mints a signed grant that decodes to operator + user identity", async () => {
    const cookie = await loginForGrant();
    const res = await fetch(`${ts!.baseUrl}/api/one/auth-grant`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { grant: string; expiresAt: number };
    assert.ok(body.grant.includes("."));
    const decoded = JSON.parse(Buffer.from(body.grant.split(".")[0], "base64url").toString("utf8"));
    assert.equal(decoded.identity, "operator");
    assert.equal(decoded.identityType, "user");
    assert.ok(decoded.exp > Date.now());
  });

  it("round-trips grant + token so AuthKit iframe can authorize without the operator cookie", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url, init) => {
        const u = url.toString();
        if (!u.startsWith("https://one.example/")) return originalFetch(url, init);
        return new Response(JSON.stringify({ rows: [], total: 0, pages: 0, page: 1, requestId: "req-grant" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const cookie = await loginForGrant();
      const grantRes = await fetch(`${ts!.baseUrl}/api/one/auth-grant`, {
        method: "POST",
        headers: { Cookie: cookie },
      });
      const { grant } = (await grantRes.json()) as { grant: string };

      const tokenRes = await fetch(`${ts!.baseUrl}/api/one/auth-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-one-grant": grant },
        body: JSON.stringify({ identity: "operator", identityType: "user" }),
      });

      assert.equal(tokenRes.status, 200);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects token issuance without any grant header", async () => {
    const cookie = await loginForGrant();
    const res = await fetch(`${ts!.baseUrl}/api/one/auth-token`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "auth grant required");
  });

  it("rejects token issuance with a tampered grant", async () => {
    const cookie = await loginForGrant();
    const grantRes = await fetch(`${ts!.baseUrl}/api/one/auth-grant`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    const { grant } = (await grantRes.json()) as { grant: string };
    const [bodyPart, sigPart] = grant.split(".");
    const tampered = `${bodyPart}.${sigPart.slice(0, -2)}ff`;

    const res = await fetch(`${ts!.baseUrl}/api/one/auth-token`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", "x-one-grant": tampered },
      body: "{}",
    });
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "invalid or expired auth grant");
  });
});
