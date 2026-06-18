import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DriveFolderCreateError, createFolder } from "../src/integrations/one/google/drive.js";

describe("Drive createFolder", () => {
  it("posts folder payload through WithOne passthrough", async () => {
    const originalFetch = globalThis.fetch;

    try {
      const seen: Array<{ url: string; init?: RequestInit }> = [];

      globalThis.fetch = async (url, init) => {
        seen.push({ url: url.toString(), init });
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: async () => ({ id: "folder-123", webViewLink: "https://drive.google.com/drive/folders/folder-123" }),
        } as unknown as Response;
      };

      const result = await createFolder("conn-key-1", "Guest Documents", "parent-456");

      assert.strictEqual(seen.length, 1);
      assert.ok(seen[0].url.includes("/passthrough/drive/v3/files"));
      assert.strictEqual(seen[0].init?.method, "POST");
      assert.strictEqual((seen[0].init?.headers as Record<string, string>)["x-one-connection-key"], "conn-key-1");
      assert.strictEqual((seen[0].init?.headers as Record<string, string>)["x-one-action-id"], "conn_mod_def::GJ6Rzy_a8J8::5DPVGp3fTXegRgMN4v11tA");
      assert.deepStrictEqual(JSON.parse(String(seen[0].init?.body)), {
        name: "Guest Documents",
        mimeType: "application/vnd.google-apps.folder",
        parents: ["parent-456"],
      });
      assert.deepStrictEqual(result, {
        id: "folder-123",
        webViewLink: "https://drive.google.com/drive/folders/folder-123",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("omits parents when parent folder is absent", async () => {
    const originalFetch = globalThis.fetch;

    try {
      let seenBody: string | undefined;

      globalThis.fetch = async (_url, init) => {
        seenBody = String(init?.body);
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: async () => ({ id: "folder-123", webViewLink: "https://drive.google.com/drive/folders/folder-123" }),
        } as unknown as Response;
      };

      await createFolder("conn-key-1", "Guest Documents");

      assert.deepStrictEqual(JSON.parse(String(seenBody)), {
        name: "Guest Documents",
        mimeType: "application/vnd.google-apps.folder",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws on malformed response", async () => {
    const originalFetch = globalThis.fetch;

    try {
      globalThis.fetch = async () => {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: async () => ({ id: 123, webViewLink: null }),
        } as unknown as Response;
      };

      await assert.rejects(
        () => createFolder("conn-key-1", "Guest Documents"),
        (error: unknown) => {
          assert.ok(error instanceof DriveFolderCreateError);
          assert.strictEqual(error.provider, "withone");
          assert.strictEqual(error.endpoint, "/drive/v3/files");
          assert.strictEqual(error.actionId, "conn_mod_def::GJ6Rzy_a8J8::5DPVGp3fTXegRgMN4v11tA");
          return true;
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
