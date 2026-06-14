import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DiningEventsPage } from "@/components/dining-events/dining-events-page";
import { StaffRolesPage } from "@/components/admin/staff-roles-page";
import { SecurityAccessPage } from "@/components/admin/security-access-page";
import { RateManagerPage } from "@/components/revenue/rate-manager-page";
import { createRestRepositories } from "@/lib/repositories";
import type {
  DiningEventBooking,
  RoomRate,
  SecurityAuditEntry,
  StaffMember,
} from "@/lib/repositories";
import type { IngestSummaryResponse, PipelineStatus } from "@/lib/repositories/types";
import type { Property, Room } from "@/types/database";

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
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
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

function requestedUrls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function propertyFixture(id: string, name: string): Property {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    total_rooms: 10,
    location: name.includes("Da Lat") ? "Da Lat" : "Ho Chi Minh City",
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("repository-backed page data", () => {
  it("renders dining events from REST-backed repository data", async () => {
    const properties = [propertyFixture("prop-1", "Mujo Saigon"), propertyFixture("prop-2", "Mujo Da Lat")];
    const events: DiningEventBooking[] = [
      {
        id: "event-1",
        title: "Private Dinner",
        type: "dinner",
        venue: "Sky Lounge",
        date: "2026-06-09",
        start_time: "18:00",
        end_time: "20:00",
        guest_count: 10,
        guest_name: "Le Anh",
        property_id: "prop-1",
        status: "confirmed",
        notes: "Birthday dinner",
      },
      {
        id: "event-2",
        title: "Team Meeting",
        type: "meeting",
        venue: "Board Room",
        date: "2026-06-09",
        start_time: "09:00",
        end_time: "10:00",
        guest_count: 4,
        guest_name: "Ops",
        property_id: "prop-1",
        status: "pending",
        notes: "",
      },
    ];
    const fetchMock = installFetchMock([
      { match: "/api/properties", response: properties },
      { match: "/api/dining-events", response: events },
    ]);

    renderWithProviders(<DiningEventsPage />);

    expect(await screen.findByTestId("dining-events-page")).toBeInTheDocument();
    expect(screen.getByTestId("events-count")).toHaveTextContent("2");
    expect(screen.getByTestId("confirmed-count")).toHaveTextContent("1");
    expect(screen.getByTestId("pending-count")).toHaveTextContent("1");
    expect(screen.getByTestId("guests-count")).toHaveTextContent("14");
    expect(screen.getByTestId("event-card-event-1")).toHaveTextContent("Private Dinner");
    expect(screen.getByTestId("event-card-event-1")).toHaveTextContent("Mujo Saigon");

    expect(requestedUrls(fetchMock)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/api/properties"),
        expect.stringContaining("/api/dining-events"),
      ])
    );
  });

  it("renders staff roles from REST-backed repository data", async () => {
    const properties = [propertyFixture("prop-1", "Mujo Saigon"), propertyFixture("prop-2", "Mujo Da Lat")];
    const staff: StaffMember[] = [
      {
        id: "staff-1",
        name: "Alice Admin",
        email: "alice@example.com",
        role: "admin",
        property_ids: ["prop-1", "prop-2"],
        status: "active",
        last_active_at: "2026-06-09T08:00:00.000Z",
      },
      {
        id: "staff-2",
        name: "Bao Manager",
        email: "bao@example.com",
        role: "manager",
        property_ids: ["prop-1"],
        status: "inactive",
        last_active_at: null,
      },
    ];
    const fetchMock = installFetchMock([
      { match: "/api/properties", response: properties },
      { match: "/api/staff", response: staff },
    ]);

    renderWithProviders(<StaffRolesPage />);

    expect(await screen.findByTestId("staff-roles-page")).toBeInTheDocument();
    expect(screen.getByTestId("total-staff")).toHaveTextContent("2");
    expect(screen.getByTestId("active-staff")).toHaveTextContent("1");
    expect(screen.getByTestId("admin-count")).toHaveTextContent("1");
    expect(screen.getByTestId("manager-count")).toHaveTextContent("1");
    expect(screen.getByTestId("staff-row-staff-1")).toHaveTextContent("All properties");
    expect(screen.getByTestId("staff-row-staff-2")).toHaveTextContent("Mujo Saigon");

    expect(requestedUrls(fetchMock)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/api/properties"),
        expect.stringContaining("/api/staff"),
      ])
    );
  });

  it("renders security audit data from REST-backed repository data", async () => {
    const entries: SecurityAuditEntry[] = [
      {
        id: "audit-1",
        timestamp: "2026-06-09T08:10:00.000Z",
        action: "Login failed",
        actor: "alice@example.com",
        resource: "/admin",
        details: "Invalid password",
        severity: "warning",
      },
      {
        id: "audit-2",
        timestamp: "2026-06-09T09:00:00.000Z",
        action: "Role changed",
        actor: "system",
        resource: "/staff/staff-1",
        details: "Admin granted",
        severity: "critical",
      },
      {
        id: "audit-3",
        timestamp: "2026-06-09T10:00:00.000Z",
        action: "Integration synced",
        actor: "sync-service",
        resource: "/integrations",
        details: "Sync finished",
        severity: "info",
      },
    ];
    const fetchMock = installFetchMock([{ match: "/api/security/audit", response: entries }]);

    renderWithProviders(<SecurityAccessPage />);

    expect(await screen.findByTestId("security-access-page")).toBeInTheDocument();
    expect(screen.getByTestId("total-events")).toHaveTextContent("3");
    expect(screen.getByTestId("warning-count")).toHaveTextContent("1");
    expect(screen.getByTestId("critical-count")).toHaveTextContent("1");
    expect(screen.getByTestId("info-count")).toHaveTextContent("1");
    expect(screen.getByTestId("audit-entry-audit-1")).toHaveTextContent("Login failed");
    expect(screen.getByTestId("audit-entry-audit-2")).toHaveTextContent("Role changed");

    expect(requestedUrls(fetchMock)).toEqual(
      expect.arrayContaining([expect.stringContaining("/api/security/audit")])
    );
  });

  it("renders rate manager data from REST-backed repository data", async () => {
    const startDate = todayIso();
    const endDate = addDays(startDate, 6);
    const properties = [propertyFixture("prop-1", "Mujo Saigon")];
    const rooms: Room[] = [
      {
        id: "room-1",
        property_id: "prop-1",
        room_number: "101",
        room_name: "Room 101",
        room_type: "Deluxe",
        status: "Vacant",
        floor: 1,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    const rates: RoomRate[] = [
      {
        id: "rate-1",
        property_id: null,
        room_type: "Deluxe",
        date: startDate,
        base_rate_vnd: 1000000,
        rate_vnd: 1000000,
      },
      {
        id: "rate-2",
        property_id: null,
        room_type: "Deluxe",
        date: addDays(startDate, 1),
        base_rate_vnd: 1000000,
        rate_vnd: 1200000,
      },
      {
        id: "rate-3",
        property_id: null,
        room_type: "Suite",
        date: startDate,
        base_rate_vnd: 1500000,
        rate_vnd: 1500000,
      },
    ];
    const fetchMock = installFetchMock([
      { match: "/api/properties", response: properties },
      { match: "/api/rooms", response: rooms },
      { match: "/api/rates", response: rates },
    ]);

    renderWithProviders(<RateManagerPage />);

    expect(await screen.findByTestId("rate-manager-page")).toBeInTheDocument();
    expect(screen.getByTestId("type-count")).toHaveTextContent("2");
    expect(screen.getByTestId("property-count")).toHaveTextContent("1");
    expect(screen.getByTestId("date-range")).toHaveTextContent(`${startDate} – ${endDate}`);
    expect(screen.getByTestId("rate-grid")).toHaveTextContent("Deluxe");
    expect(screen.getByTestId("rate-grid")).toHaveTextContent("Suite");
    expect(screen.getByTestId("rate-grid")).toHaveTextContent("1.200.000");
    expect(screen.getByText("Override")).toBeInTheDocument();

    expect(requestedUrls(fetchMock)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/api/properties"),
        expect.stringContaining("/api/rooms"),
        expect.stringContaining(`/api/rates?start_date=${startDate}&end_date=${endDate}`),
      ])
    );
  });

  it("wires ingest pipeline endpoints through REST repository methods", async () => {
    const pipelineStatus: PipelineStatus = {
      enabled: true,
      phase: "scaffolded",
      connectors: [],
      googleCredentials: {
        configured: false,
        readable: false,
      },
    };
    const syncResponse: IngestSummaryResponse = {
      syncRunId: "sync-1",
      dryRun: false,
      processed: 3,
      created: 2,
      updated: 1,
      skipped: 0,
      deadLetters: 0,
      errors: [],
    };
    const uploadResponse: IngestSummaryResponse = {
      syncRunId: "upload-1",
      dryRun: false,
      processed: 1,
      created: 1,
      updated: 0,
      skipped: 0,
      deadLetters: 0,
      errors: [],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/ingest/pipeline/status")) {
        return jsonResponse(pipelineStatus);
      }

      if (url.includes("/api/ingest/pipeline/run")) {
        return jsonResponse(syncResponse);
      }

      if (url.includes("/api/ingest/reservations")) {
        return jsonResponse(uploadResponse);
      }

      throw new Error(`Unhandled URL: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const repos = createRestRepositories();
    const formData = new FormData();
    formData.append("source", "reservations.csv");

    expect(await repos.ingest.getPipelineStatus()).toEqual(pipelineStatus);
    expect(await repos.ingest.runBuiltInListingsSync()).toEqual(syncResponse);
    expect(await repos.ingest.uploadReservations(formData)).toEqual(uploadResponse);

    const calls = fetchMock.mock.calls as Array<[RequestInfo | URL, RequestInit?]>;
    const urls = requestedUrls(fetchMock);
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/api/ingest/pipeline/status"),
        expect.stringContaining("/api/ingest/pipeline/run"),
        expect.stringContaining("/api/ingest/reservations"),
      ])
    );

    const runCall = calls.find(([url]) => String(url).includes("/api/ingest/pipeline/run"));
    if (!runCall) {
      throw new Error("Missing pipeline run call");
    }

    const runBody = runCall[1]?.body;
    if (typeof runBody !== "string") {
      throw new Error("Pipeline run body is not JSON string");
    }

    expect(JSON.parse(runBody)).toEqual({
      mode: "built-in",
      targetKind: "listings",
      dryRun: false,
    });

    const uploadCall = calls.find(([url]) => String(url).includes("/api/ingest/reservations"));
    if (!uploadCall) {
      throw new Error("Missing reservations upload call");
    }

    expect(uploadCall[1]?.method).toBe("POST");
    expect(uploadCall[1]?.body).toBeInstanceOf(FormData);

    if (!(uploadCall[1]?.body instanceof FormData)) {
      throw new Error("Reservations upload body is not FormData");
    }

    expect(Array.from(uploadCall[1].body.entries())).toEqual([["source", "reservations.csv"]]);
  });
});
