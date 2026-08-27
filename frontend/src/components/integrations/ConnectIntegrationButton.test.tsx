import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { buildOneAuthHeaders, ConnectIntegrationButton } from "./ConnectIntegrationButton";

const useOneAuthMock = vi.fn();
const useAuthGrantMock = vi.fn();
const usePersistConnectionMock = vi.fn();

vi.mock("@withone/auth", () => ({
  useOneAuth: (config: unknown) => {
    useOneAuthMock(config);
    return { open: () => {} };
  },
}));

vi.mock("@/hooks/use-one-connections", () => ({
  useAuthGrant: (enabled: boolean) => {
    useAuthGrantMock(enabled);
    return { data: { grant: "signed-grant-token", expiresAt: Date.now() + 60000 }, isFetching: false };
  },
  usePersistConnection: () => {
    const mutate = vi.fn();
    usePersistConnectionMock(mutate);
    return { mutate, isPending: false };
  },
}));

describe("ConnectIntegrationButton AuthKit config", () => {
  it("returns empty headers when no grant is available", () => {
    expect(buildOneAuthHeaders(undefined)).toEqual({});
  });

  it("passes the signed grant through the x-one-grant header", () => {
    expect(buildOneAuthHeaders("opaque-grant-token")).toEqual({ "x-one-grant": "opaque-grant-token" });
  });

  it("passes an absolute token URL and the grant header into useOneAuth", () => {
    render(<ConnectIntegrationButton platform="google-drive" authenticated={true} />);

    expect(useOneAuthMock).toHaveBeenCalledTimes(1);
    const config = useOneAuthMock.mock.calls[0][0] as {
      token: { url: string; headers: Record<string, string> };
      selectedConnection: string;
    };
    expect(config.token.url).toBe(`${window.location.origin}/api/one/auth-token`);
    expect(config.token.headers).toEqual({ "x-one-grant": "signed-grant-token" });
    expect(config.selectedConnection).toBe("Google Drive");
    expect(useAuthGrantMock).toHaveBeenCalledWith(true);
  });

  it("gates the grant query behind the authenticated flag", () => {
    render(<ConnectIntegrationButton platform="gmail" authenticated={false} />);
    expect(useAuthGrantMock).toHaveBeenCalledWith(false);
  });
});
