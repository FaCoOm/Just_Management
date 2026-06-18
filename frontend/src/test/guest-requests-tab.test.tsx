import { createElement, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestRequestsTab } from "../components/guests/guest-requests-tab";
import { useCreateGuestRequest, useGuestRequests, useTransitionGuestRequest } from "../hooks/use-guests-tenants-data";

vi.mock("@/hooks/use-guests-tenants-data", () => ({
  useGuestRequests: vi.fn(),
  useCreateGuestRequest: vi.fn(),
  useTransitionGuestRequest: vi.fn(),
}));

const useGuestRequestsMock = vi.mocked(useGuestRequests);
const useCreateGuestRequestMock = vi.mocked(useCreateGuestRequest);
const useTransitionGuestRequestMock = vi.mocked(useTransitionGuestRequest);

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function W({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("GuestRequestsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGuestRequestsMock.mockReturnValue({
      data: [
        { id: "r1", guest_id: "g1", room_id: "room-1", request_type: "Towel", notes: "Need towels", description: "Need towels", status: "open", priority: "medium", assigned_to: null, created_at: "2026-06-17T10:00:00Z", updated_at: "2026-06-17T10:00:00Z" },
        { id: "r2", guest_id: "g2", room_id: "room-1", request_type: "Laundry", notes: "Pick up laundry", description: "Pick up laundry", status: "reopened", priority: "high", assigned_to: null, created_at: "2026-06-17T11:00:00Z", updated_at: "2026-06-17T11:00:00Z" },
      ],
      isLoading: false,
    } as never);
    useCreateGuestRequestMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    useTransitionGuestRequestMock.mockReturnValue({ mutate: vi.fn() } as never);
  });

  it("renders empty state and request dialog", () => {
    useGuestRequestsMock.mockReturnValueOnce({ data: [], isLoading: false } as never);
    render(<GuestRequestsTab propertyId="property-1" guestId="guest-1" roomId="room-1" />, { wrapper: wrapper() });

    expect(screen.getByText("No guest requests. Create the first one above.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /new request/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("New Request")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Guest ID")).toHaveValue("guest-1");
    expect(within(dialog).getByLabelText("Room ID")).toHaveValue("room-1");
  });

  it("filters requests by search text", () => {
    render(<GuestRequestsTab propertyId="property-1" />, { wrapper: wrapper() });

    expect(screen.getByText("Need towels")).toBeInTheDocument();
    expect(screen.getByText("Pick up laundry")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Request search"), { target: { value: "laundry" } });

    expect(screen.queryByText("Need towels")).not.toBeInTheDocument();
    expect(screen.getByText("Pick up laundry")).toBeInTheDocument();

    expect(screen.getByText("Pick up laundry")).toBeInTheDocument();
    expect(screen.queryByText("Need towels")).not.toBeInTheDocument();
  });
});
