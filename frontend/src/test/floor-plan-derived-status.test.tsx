import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { RoomsPage } from "@/components/rooms/rooms-page";
import { getVietnamToday } from "@/lib/vietnam-time";
import type { Property, Reservation, Room } from "@/types/database";

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
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>{ui}</SidebarProvider>
    </QueryClientProvider>
  );
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetchMock(routes: Array<{ match: string; response: unknown }>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const route = routes.find((entry) => url.includes(entry.match));

    if (!route) {
      throw new Error(`Unhandled URL: ${url}`);
    }

    return jsonResponse(route.response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const property: Property = {
  id: "property-1",
  name: "Mujo Test",
  slug: "mujo-test",
  total_rooms: 3,
  location: "Ho Chi Minh City",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
};

const rooms: Room[] = [
  {
    id: "room-a",
    property_id: property.id,
    room_number: "101",
    room_name: "Room 101",
    room_type: "Standard",
    status: "Vacant",
    floor: 1,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "room-b",
    property_id: property.id,
    room_number: "102",
    room_name: "Room 102",
    room_type: "Standard",
    status: "Vacant",
    floor: 1,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "room-c",
    property_id: property.id,
    room_number: "103",
    room_name: "Room 103",
    room_type: "Standard",
    status: "Needs Attention",
    floor: 1,
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

function dateKey(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return getVietnamToday(date);
}

function activeReservation(): Reservation {
  return {
  id: "reservation-1",
  property_id: property.id,
  primary_room_id: "room-a",
  status: "checked_in",
  check_in_date: dateKey(-1),
  check_out_date: dateKey(2),
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
}

function allocationReservation(): Reservation {
  return {
    ...activeReservation(),
    id: "reservation-allocation",
    primary_room_id: null,
    guest_name: "Allocation Guest",
    check_in_date: "2026-01-01",
    check_out_date: "2099-01-01",
    reservation_room_allocations: [
      {
        id: "allocation-1",
        reservation_id: "reservation-allocation",
        room_id: "room-b",
        allocation_role: "stay",
        sort_order: 1,
        notes: "",
        created_at: "2026-06-12T00:00:00.000Z",
        updated_at: "2026-06-12T00:00:00.000Z",
      },
    ],
  };
}

describe("Floor Plan derived room status", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders reservation-derived status while preserving vacant and attention rooms", async () => {
    installFetchMock([
      { match: "/api/properties", response: [property] },
      { match: "/api/rooms", response: rooms },
      { match: "/api/reservations", response: [activeReservation()] },
    ]);

    renderWithProviders(<RoomsPage />);

    const roomA = await screen.findByTitle(/Room 101 — Checked In — QA Guest/);
    const roomB = await screen.findByTitle(/Room 102 — Vacant/);
    const roomC = await screen.findByTitle(/Room 103 — Needs Attention/);

    expect(within(roomA).getByText("101").previousElementSibling).toHaveClass("bg-chart-1");
    expect(within(roomB).getByText("102").previousElementSibling).toHaveClass("bg-emerald-500");
    expect(within(roomC).getByText("103").previousElementSibling).toHaveClass("bg-destructive");
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("derives status from reservation allocation rows when primary_room_id is absent", async () => {
    installFetchMock([
      { match: "/api/properties", response: [property] },
      { match: "/api/rooms", response: rooms },
      { match: "/api/reservations", response: [allocationReservation()] },
    ]);

    renderWithProviders(<RoomsPage />);

    const roomB = await screen.findByTitle(/Room 102 — Checked In/);

    expect(within(roomB).getByText("102").previousElementSibling).toHaveClass("bg-chart-1");
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("does not treat checked-out reservations as occupying rooms", async () => {
    installFetchMock([
      { match: "/api/properties", response: [property] },
      { match: "/api/rooms", response: rooms },
      { match: "/api/reservations", response: [{ ...activeReservation(), status: "checked_out" }] },
    ]);

    renderWithProviders(<RoomsPage />);

    const roomA = await screen.findByTitle(/Room 101 — Vacant/);

    expect(within(roomA).getByText("101").previousElementSibling).toHaveClass("bg-emerald-500");
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
