import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { issueAuthKitToken } from "../src/integrations/one/auth-token.js";

describe("issueAuthKitToken", () => {
  it("returns the WithOne AuthKit payload without requiring a legacy token field", async () => {
    const originalFetch = globalThis.fetch;
    const originalSecret = process.env.ONE_SECRET_KEY;
    const originalBase = process.env.ONE_API_BASE;

    try {
      process.env.ONE_SECRET_KEY = "test-secret";
      process.env.ONE_API_BASE = "https://one.example/v1";

      let requestedUrl = "";
      let requestedBody = "";
      globalThis.fetch = async (url, init) => {
        requestedUrl = url.toString();
        requestedBody = String(init?.body);

        return new Response(JSON.stringify({ rows: [], total: 0, pages: 0, page: 1, requestId: "req-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const result = await issueAuthKitToken({ identity: "dev-admin-1", identityType: "user" });

      assert.strictEqual(requestedUrl, "https://one.example/v1/authkit/token");
      assert.deepStrictEqual(JSON.parse(requestedBody), { identity: "dev-admin-1", identityType: "user" });
      assert.deepStrictEqual(result, { rows: [], total: 0, pages: 0, page: 1, requestId: "req-1" });
    } finally {
      globalThis.fetch = originalFetch;
      process.env.ONE_SECRET_KEY = originalSecret;
      process.env.ONE_API_BASE = originalBase;
    }
  });
});
