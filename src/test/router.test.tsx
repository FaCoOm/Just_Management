import { describe, it, expect } from "vitest";
import { router } from "../router";

describe("Router Configuration", () => {
  it("should contain all the lazy-loaded routes promised in the sidebar", () => {
    expect(router).toBeDefined();
    const paths = Object.keys(router.routesByPath);

    const expectedPaths = [
      "/",
      "/reservations",
      "/check-in-out",
      "/guests",
      "/guests/vip",
      "/rooms",
      "/rooms/types",
      "/rooms/availability",
      "/housekeeping",
      "/dining-events",
      "/rate-manager",
      "/billing",
      "/channels",
      "/staff",
      "/maintenance",
      "/security",
      "/tax-export",
      "/settings/integrations",
    ];

    for (const p of expectedPaths) {
      expect(paths).toContain(p);
    }
  });
});
