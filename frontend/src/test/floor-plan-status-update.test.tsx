import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { RoomsPage } from "@/components/rooms/rooms-page";
import type { Property, Reservation, Room } from "@/types/database";

const toastError = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

if (!globalThis.matchMedia) {
  globalThis.matchMedia = function () {
    return {
      matches: false,
      media: "",
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    };
  };
}

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>{ui}</SidebarProvider>
    </QueryClientProvider>
  );
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const property: Property = {
  id: "property-1",
  name: "Mujo Test",
  slug: "mujo-test",
  total_rooms: 1,
  location: "Ho Chi Minh City",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
};

const room: Room = {
  id: "room-a",
  property_id: property.id,
  room_number: "101",
  room_name: "Room 101",
  room_type: "Standard",
  status: "Vacant",
  floor: 1,
  created_at: "2026-01-01T00:00:00.000Z",
};

const reservation: Reservation = {
  id: "reservation-1",
  property_id: property.id,
  primary_room_id: room.id,
  status: "pending",
  check_in_date: "2026-01-01",
  check_out_date: "2099-01-01",
  guest_name: "QA Guest",
  guest_phone: null,
  guest_email: null,
  adult_count: 1,
  child_count: 0,
  infant_count: 0,
  guest_count: 1,
  operational_notes: "",
  guest_notes: "",
  created_at: "2026-06-12T00:00:00.000Z",
  updated_at: "2026-06-12T00:00:00.000Z",
};

function installFetchMock(options: { patchStatus?: number } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/properties")) return jsonResponse([property]);
    if (url.includes("/api/rooms") && init?.method !== "PATCH") return jsonResponse([room]);
    if (url.includes("/api/reservations")) return jsonResponse([reservation]);
    if (url.includes(`/api/rooms/${room.id}/status`) && init?.method === "PATCH") {
      if (options.patchStatus === 409) return jsonResponse({ error: "No active reservation for room" }, 409);
      return jsonResponse({ room, reservation: { ...reservation, status: "checked_in" } });
    }
    if (url.includes("/api/dashboard/summary")) return jsonResponse({});
    throw new Error(`Unhandled URL: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Floor Plan room status updates", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastError.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the status chooser and PATCHes the selected room status", async () => {
    const fetchMock = installFetchMock();
    renderWithProviders(<RoomsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /room 101/i }));
    expect(screen.getByRole("dialog", { name: /update room status/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Checked In" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/api/rooms/${room.id}/status`),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "Checked In" }),
        })
      );
    });
  });

  it("shows an error toast when the backend rejects the status update", async () => {
    installFetchMock({ patchStatus: 409 });
    renderWithProviders(<RoomsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /room 101/i }));
    fireEvent.click(screen.getByRole("button", { name: "Checked In" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(expect.stringContaining("No active reservation for room"));
    });
  });
});
