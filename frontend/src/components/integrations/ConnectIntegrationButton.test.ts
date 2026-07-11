import { describe, expect, it, vi } from "vitest";

describe("ConnectIntegrationButton AuthKit config", () => {
  it("uses VITE_ONE_DEV_TOKEN for the token endpoint header", async () => {
    vi.stubEnv("VITE_ONE_DEV_TOKEN", "env-dev-token");
    vi.resetModules();

    const { buildOneAuthHeaders } = await import("./ConnectIntegrationButton");

    expect(buildOneAuthHeaders()).toEqual({ "x-user-id": "dev-admin-1", "x-dev-token": "env-dev-token" });
    vi.unstubAllEnvs();
  });
});
