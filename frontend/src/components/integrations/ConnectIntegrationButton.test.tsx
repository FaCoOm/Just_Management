import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildOneAuthHeaders, ConnectIntegrationButton } from "./ConnectIntegrationButton";

const useOneAuthMock = vi.fn();
const useAuthGrantMock = vi.fn();
const grantFixture = vi.hoisted(() => ({
  data: { grant: "signed-grant-token", expiresAt: 0 } as { grant: string; expiresAt: number } | undefined,
  isFetching: false,
}));

vi.mock("@withone/auth", () => ({
  useOneAuth: (config: unknown) => {
    useOneAuthMock(config);
    return { open: () => {} };
  },
}));

vi.mock("@/hooks/use-one-connections", () => ({
  useAuthGrant: (enabled: boolean) => {
    useAuthGrantMock(enabled);
    return { data: grantFixture.data, isFetching: grantFixture.isFetching };
  },
  usePersistConnection: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

afterEach(() => {
  grantFixture.data = { grant: "signed-grant-token", expiresAt: 0 };
  grantFixture.isFetching = false;
});

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

  it("disables the button while grant data is unavailable", () => {
    grantFixture.data = undefined;
    render(<ConnectIntegrationButton platform="google-sheets" authenticated={true} />);
    const button = screen.getByRole("button", { name: /connect google sheets/i });
    expect(button).toBeDisabled();
  });

  it("shows a Preparing label while the grant query is in flight", () => {
    grantFixture.data = undefined;
    grantFixture.isFetching = true;
    render(<ConnectIntegrationButton platform="google-sheets" authenticated={true} />);
    const button = screen.getByRole("button", { name: /preparing/i });
    expect(button).toBeDisabled();
  });
});