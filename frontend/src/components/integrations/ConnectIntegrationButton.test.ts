import { describe, expect, it, vi } from "vitest";

describe("ConnectIntegrationButton AuthKit config", () => {
  it("does not expose operator identity or secrets in token headers", async () => {
    vi.resetModules();

    const { buildOneAuthHeaders } = await import("./ConnectIntegrationButton");

    expect(buildOneAuthHeaders()).toEqual({});
  });
});
