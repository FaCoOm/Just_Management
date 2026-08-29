import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthGrant } from "./use-one-connections";

const mintAuthGrant = vi.hoisted(() => vi.fn());

vi.mock("@/lib/repositories", () => ({
  createRestRepositories: () => ({ integrations: { mintAuthGrant } }),
}));

describe("useAuthGrant", () => {
  afterEach(() => {
    vi.useRealTimers();
    mintAuthGrant.mockReset();
  });

  it("remints the grant before the server grant expires", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mintAuthGrant.mockResolvedValue({ grant: "grant", expiresAt: Date.now() + 300_000 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    renderHook(() => useAuthGrant(true), { wrapper });
    await waitFor(() => expect(mintAuthGrant).toHaveBeenCalledTimes(1));

    await act(() => vi.advanceTimersByTimeAsync(4 * 60_000));

    await waitFor(() => expect(mintAuthGrant).toHaveBeenCalledTimes(2));
    client.clear();
  });
});
