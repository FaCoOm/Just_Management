import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeDatabaseUrl } from "../src/lib/prisma.js";

describe("sanitizeDatabaseUrl", () => {
  it("removes TLS certificate file parameters while preserving sslmode", () => {
    const input = "postgresql://user:pass@example.postgres.database.azure.com:5432/db?sslmode=require&sslcert=missing.crt&sslrootcert=also-missing.crt&sslkey=missing.key";

    const sanitized = new URL(sanitizeDatabaseUrl(input));

    assert.equal(sanitized.searchParams.get("sslmode"), "require");
    assert.equal(sanitized.searchParams.has("sslcert"), false);
    assert.equal(sanitized.searchParams.has("sslrootcert"), false);
    assert.equal(sanitized.searchParams.has("sslkey"), false);
  });

  it("leaves invalid database URLs unchanged", () => {
    assert.equal(sanitizeDatabaseUrl("not a url"), "not a url");
  });
});
