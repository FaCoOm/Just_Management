import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AvailabilityPage } from "@/components/rooms/availability-page";
import { HousekeepingPage } from "@/components/housekeeping/housekeeping-page";
import { RoomTypesPage } from "@/components/rooms/room-types-page";
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
}

const property: Property = {
  id: "property-1",
  name: "Mujo Test",
  slug: "mujo-test",
  total_rooms: 2,
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
];

function dateKey(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return getVietnamToday(date);
}

function activeAllocationReservation(): Reservation {
  return {
    id: "reservation-allocation",
    property_id: property.id,
    primary_room_id: null,
    status: "checked_in",
    check_in_date: "2026-01-01",
    check_out_date: "2099-01-01",
    guest_name: "Allocation Guest",
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

function checkoutPendingReservation(): Reservation {
  return {
    ...activeAllocationReservation(),
    id: "reservation-checkout",
    primary_room_id: "room-a",
    status: "check_out_pending",
    check_in_date: dateKey(-2),
    check_out_date: dateKey(1),
    guest_name: "Checkout Guest",
    reservation_room_allocations: [],
  };
}

describe("reservation-derived status on related room pages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("counts allocation-only reservations on the availability grid", async () => {
    installFetchMock([
      { match: "/api/properties", response: [property] },
      { match: "/api/rooms", response: rooms },
      { match: "/api/reservations", response: [activeAllocationReservation()] },
    ]);

    renderWithProviders(<AvailabilityPage />);

    expect(await screen.findByTestId("occupied-today")).toHaveTextContent("1");
    expect(screen.getByTestId("vacant-today")).toHaveTextContent("1");
    expect(screen.getByTestId("occupancy-rate")).toHaveTextContent("50%");
  });

  it("uses reservation-derived status for room type occupancy counts", async () => {
    installFetchMock([
      { match: "/api/properties", response: [property] },
      { match: "/api/rooms", response: rooms },
      { match: "/api/reservations", response: [activeAllocationReservation()] },
    ]);

    renderWithProviders(<RoomTypesPage />);

    expect(await screen.findByTestId("occupied-count")).toHaveTextContent("1");
    expect(screen.getByTestId("avg-occupancy")).toHaveTextContent("50%");
  });

  it("uses reservation-derived checkout pending status for housekeeping priority", async () => {
    installFetchMock([
      { match: "/api/properties", response: [property] },
      { match: "/api/rooms", response: rooms },
      { match: "/api/reservations", response: [checkoutPendingReservation()] },
    ]);

    renderWithProviders(<HousekeepingPage />);

    expect(await screen.findByTestId("dirty-count")).toHaveTextContent("1");
    expect(screen.getByTestId("ready-count")).toHaveTextContent("1");
    expect(screen.getByText("Checkout Today")).toBeInTheDocument();
  });
});
