import { createElement, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StayRecordsTab } from "../components/guests/stay-records-tab";
import { useTenants } from "../hooks/use-guests-tenants-data";
import { useStayRecordsData } from "../hooks/use-stay-records-data";

vi.mock("@/hooks/use-guests-tenants-data", () => ({
  useTenants: vi.fn(),
}));
vi.mock("@/hooks/use-stay-records-data", () => ({ useStayRecordsData: vi.fn() }));

const useTenantsMock = vi.mocked(useTenants);
const useStayRecordsDataMock = vi.mocked(useStayRecordsData);

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function W({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("StayRecordsTab file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      value: vi.fn(),
      configurable: true,
    });
    useTenantsMock.mockReturnValue({
      data: [
        {
          id: "tenant-1",
          property_id: "property-1",
          name: "Nguyen Hoa",
          id_document_type: "passport",
          id_document_number: "P123",
          lease_start: "2026-01-10",
          lease_end: "2026-12-31",
          monthly_rent: 1200,
          status: "active",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          is_vip: true,
        },
      ],
      isLoading: false,
    } as never);
    useStayRecordsDataMock.mockReturnValue({
      shortTerm: [
        {
          id: "stay-1",
          reservation_id: "reservation-1",
          channel_id: null,
          external_ref_id: null,
          platform_reference: "platform-1",
          stay_type: "short_term",
          experience_notes: "Quiet stay",
          guest_request_content: "Extra towels",
          created_at: "2026-06-17T00:00:00Z",
          updated_at: "2026-06-17T00:00:00Z",
          reservation: {
            id: "reservation-1",
            property_id: "property-1",
            primary_room_id: null,
            status: "pending",
            check_in_date: "2026-06-17",
            check_out_date: "2026-06-18",
            guest_name: "Nguyen Hoa",
            guest_phone: null,
            guest_email: null,
            adult_count: 2,
            child_count: 0,
            infant_count: 0,
            guest_count: 2,
            operational_notes: "",
            guest_notes: "",
            created_at: "2026-06-17T00:00:00Z",
            updated_at: "2026-06-17T00:00:00Z",
          },
        },
      ],
      longTerm: [],
      reservations: [],
      loading: false,
    } as never);
  });

  it("renders short-term and long-term views with tenant detail sheet", () => {
    render(<StayRecordsTab propertyId="property-1" />, { wrapper: wrapper() });

    expect(screen.getByText("Nguyen Hoa")).toBeInTheDocument();
    expect(screen.getByText("Long-term Tenants")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /long-term tenants/i }));

    expect(screen.getByText("Lease Start")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("row", { name: /nguyen hoa/i }));
    expect(screen.getByText("Read-only tenant profile and linked stay registrations.")).toBeInTheDocument();
    expect(screen.getAllByText("ID Document Type")).toHaveLength(2);
    expect(screen.queryByText("P123")).not.toBeInTheDocument();
  });

  it("filters vip tenants in long-term view", () => {
    useTenantsMock.mockReturnValueOnce({
      data: [
        {
          id: "tenant-1",
          property_id: "property-1",
          name: "Nguyen Hoa",
          id_document_type: "passport",
          id_document_number: "P123",
          lease_start: "2026-01-10",
          lease_end: "2026-12-31",
          monthly_rent: 1200,
          status: "active",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          is_vip: true,
        },
        {
          id: "tenant-2",
          property_id: "property-1",
          name: "Tran Nam",
          id_document_type: "citizen_id",
          id_document_number: "C456",
          lease_start: "2026-02-01",
          lease_end: "2026-12-31",
          monthly_rent: 1000,
          status: "active",
          created_at: "2026-01-02T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
          is_vip: false,
        },
      ],
      isLoading: false,
    } as never);

    render(<StayRecordsTab propertyId="property-1" />, { wrapper: wrapper() });

    fireEvent.click(screen.getByRole("button", { name: /long-term tenants/i }));
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(screen.getByText("VIP only"));

    expect(screen.getByText("Nguyen Hoa")).toBeInTheDocument();
    expect(screen.queryByText("Tran Nam")).not.toBeInTheDocument();
  });
});
