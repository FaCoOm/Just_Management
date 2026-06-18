import { createElement, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StayRegistrationTab } from "../components/guests/stay-registration-tab";
const hookMocks = vi.hoisted(() => ({
  useTenants: vi.fn(),
  useStayRegistrations: vi.fn(),
  useCreateStayRegistration: vi.fn(),
}));

vi.mock("@/hooks/use-guests-tenants-data", () => hookMocks);
vi.mock("../hooks/use-guests-tenants-data", () => hookMocks);

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function W({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("StayRegistrationTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookMocks.useTenants.mockReturnValue({ data: [], isLoading: false } as never);
    hookMocks.useStayRegistrations.mockReturnValue({ data: [], isLoading: false } as never);
    hookMocks.useCreateStayRegistration.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  });

  it("renders empty state", () => {
    render(<StayRegistrationTab propertyId="property-1" />, { wrapper: wrapper() });

    expect(screen.getByText("No stay registrations yet. Register the first stay above.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /register stay/i })).toBeInTheDocument();
  });

  it("opens read-only detail dialog from the row action", () => {
    hookMocks.useTenants.mockReturnValue({
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
    hookMocks.useStayRegistrations.mockReturnValue({
      data: [
        {
          id: "stay-1",
          property_id: "property-1",
          tenant_id: "tenant-1",
          guest_name: "Nguyen Hoa",
          guest_count: 2,
          registration_date: "2026-06-17",
          drive_folder_status: "created",
          drive_folder_id: "folder-123",
          notes: "Late arrival",
          created_at: "2026-06-17T00:00:00Z",
          updated_at: "2026-06-17T00:00:00Z",
        },
      ],
      isLoading: false,
    } as never);

    render(<StayRegistrationTab propertyId="property-1" />, { wrapper: wrapper() });

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    const dialog = screen.getByRole("dialog");
    const scoped = within(dialog);

    expect(scoped.getByText("Stay Registration Detail")).toBeInTheDocument();
    expect(scoped.getByText("Tenant / Guest Name")).toBeInTheDocument();
    expect(scoped.getByText("Nguyen Hoa")).toBeInTheDocument();
    expect(scoped.getByText("Guest Count")).toBeInTheDocument();
    expect(scoped.getByText("2")).toBeInTheDocument();
    expect(scoped.getByText("Registration Date")).toBeInTheDocument();
    expect(scoped.getByText("2026-06-17")).toBeInTheDocument();
    expect(scoped.getByText("Drive Folder Status")).toBeInTheDocument();
    expect(scoped.getByText("created")).toBeInTheDocument();
    expect(scoped.getByText("Drive Folder ID")).toBeInTheDocument();
    expect(scoped.getByText("folder-123")).toBeInTheDocument();
    expect(scoped.getByText("Late arrival")).toBeInTheDocument();
  });
});
