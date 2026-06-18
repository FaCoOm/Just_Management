import { createElement, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateGuestRequest,
  useCreateStayRegistration,
  useCreateTenant,
  useGuestRequests,
  useStayRegistrations,
  useTenants,
  useTransitionGuestRequest,
} from "@/hooks/use-guests-tenants-data";
import { dashboardKeys } from "@/lib/query-keys";
import { createRestRepositories } from "@/lib/repositories";
import type { RepositoryFactory } from "@/lib/repositories";
import type { GuestRequest, StayRegistration, Tenant } from "@/types/database";

vi.mock("@/lib/repositories", () => ({
  createRestRepositories: vi.fn(),
}));

const createRestRepositoriesMock = vi.mocked(createRestRepositories);

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createRepositoryFactory(overrides?: Partial<RepositoryFactory>): RepositoryFactory {
  return {
    dashboard: {} as RepositoryFactory["dashboard"],
    properties: {} as RepositoryFactory["properties"],
    rooms: {} as RepositoryFactory["rooms"],
    reservations: {} as RepositoryFactory["reservations"],
    guestRequests: {
      getAll: vi.fn(),
      getById: vi.fn(),
      getByPropertyId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      transitionStatus: vi.fn(),
      delete: vi.fn(),
    },
    tenantRepository: {
      getById: vi.fn(),
      getAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    stayRegistrationRepository: {
      getById: vi.fn(),
      getAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    maintenance: {} as RepositoryFactory["maintenance"],
    stats: {} as RepositoryFactory["stats"],
    channels: {} as RepositoryFactory["channels"],
    taxExport: {} as RepositoryFactory["taxExport"],
    integrations: {} as RepositoryFactory["integrations"],
    ingest: {} as RepositoryFactory["ingest"],
    diningEvents: {} as RepositoryFactory["diningEvents"],
    staff: {} as RepositoryFactory["staff"],
    securityAudit: {} as RepositoryFactory["securityAudit"],
    rates: {} as RepositoryFactory["rates"],
    ...overrides,
  };
}

describe("use-guests-tenants-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads tenants via tenantRepository.getAll", async () => {
    const tenants = [{ id: "tenant-1" }] as Tenant[];
    const repos = createRepositoryFactory();
    vi.mocked(repos.tenantRepository.getAll).mockResolvedValue(tenants);
    createRestRepositoriesMock.mockReturnValue(repos);

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useTenants("property-1", { status: "active" }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(repos.tenantRepository.getAll).toHaveBeenCalledWith("property-1", { status: "active" });
    expect(result.current.data).toEqual(tenants);
  });

  it("loads stay registrations via stayRegistrationRepository.getAll", async () => {
    const registrations = [{ id: "stay-1" }] as StayRegistration[];
    const repos = createRepositoryFactory();
    vi.mocked(repos.stayRegistrationRepository.getAll).mockResolvedValue(registrations);
    createRestRepositoriesMock.mockReturnValue(repos);

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useStayRegistrations("property-1", { tenant_id: "tenant-1", room_id: "room-1" }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(repos.stayRegistrationRepository.getAll).toHaveBeenCalledWith("property-1", {
      tenant_id: "tenant-1",
      room_id: "room-1",
    });
    expect(result.current.data).toEqual(registrations);
  });

  it("filters guest requests client-side after repository fetch", async () => {
    const requests = [
      { id: "1", status: "open", priority: "high", assigned_to: null },
      { id: "2", status: "fulfilled", priority: "low", assigned_to: "agent-1" },
      { id: "3", status: "open", priority: "high", assigned_to: "agent-1" },
    ] as GuestRequest[];
    const repos = createRepositoryFactory();
    vi.mocked(repos.guestRequests.getByPropertyId).mockResolvedValue(requests);
    createRestRepositoriesMock.mockReturnValue(repos);

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useGuestRequests("property-1", {
          status: "open",
          priority: "high",
          assigned_to: "agent-1",
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(repos.guestRequests.getByPropertyId).toHaveBeenCalledWith("property-1");
    expect(result.current.data).toEqual([requests[2]]);
  });

  it("creates tenant and invalidates tenant queries", async () => {
    const repos = createRepositoryFactory();
    vi.mocked(repos.tenantRepository.create).mockResolvedValue({ id: "tenant-1" } as Tenant);
    createRestRepositoriesMock.mockReturnValue(repos);

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateTenant(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        property_id: "property-1",
        name: "Tenant A",
        id_document_type: "passport",
        id_document_number: "P123",
        lease_start: "2026-01-01",
        lease_end: "2026-12-31",
        monthly_rent: 1000,
      });
    });

    expect(repos.tenantRepository.create).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dashboardKeys.tenants });
  });

  it("creates stay registration and invalidates stay-registration queries", async () => {
    const repos = createRepositoryFactory();
    vi.mocked(repos.stayRegistrationRepository.create).mockResolvedValue({ id: "stay-1" } as StayRegistration);
    createRestRepositoriesMock.mockReturnValue(repos);

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateStayRegistration(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        property_id: "property-1",
        guest_name: "Guest A",
        guest_count: 2,
        registration_date: "2026-06-17",
      });
    });

    expect(repos.stayRegistrationRepository.create).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dashboardKeys.stayRegistrations });
  });

  it("creates guest request and invalidates guest-request queries", async () => {
    const repos = createRepositoryFactory();
    vi.mocked(repos.guestRequests.create).mockResolvedValue({ id: "request-1" } as GuestRequest);
    createRestRepositoriesMock.mockReturnValue(repos);

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateGuestRequest(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        guest_id: "guest-1",
        room_id: "room-1",
        request_type: "Laundry",
        notes: "Need pickup",
        is_completed: false,
      });
    });

    expect(repos.guestRequests.create).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dashboardKeys.guestRequests });
  });

  it("transitions guest request status and invalidates guest-request queries", async () => {
    const repos = createRepositoryFactory();
    vi.mocked(repos.guestRequests.transitionStatus).mockResolvedValue({ id: "request-1" } as GuestRequest);
    createRestRepositoriesMock.mockReturnValue(repos);

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useTransitionGuestRequest(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: "request-1",
        status: "assigned",
        assigned_to: "agent-1",
      });
    });

    expect(repos.guestRequests.transitionStatus).toHaveBeenCalledWith(
      "request-1",
      "assigned",
      "agent-1"
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dashboardKeys.guestRequests });
  });
});
