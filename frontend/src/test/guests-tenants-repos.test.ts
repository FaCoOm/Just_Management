import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GuestRequestCreateInput,
  GuestRequestRepository,
  GuestRequestUpdateInput,
  RepositoryFactory,
  StayRegistrationCreateInput,
  StayRegistrationRepository,
  StayRegistrationUpdateInput,
  TenantCreateInput,
  TenantRepository,
  TenantUpdateInput,
} from "../lib/repositories/types";
import type {
  GuestRequest,
  GuestRequestPriority,
  GuestRequestStatus,
  StayRegistration,
  Tenant,
  TenantStatus,
} from "../types/database";
import { createRestRepositories } from "../lib/repositories/rest-repositories";

const guestRequest = {
  id: "guest-request-1",
} as GuestRequest;

const tenant = {
  id: "tenant-1",
} as Tenant;

const stayRegistration = {
  id: "stay-registration-1",
} as StayRegistration;

function mockFetch(ok = true, body: unknown = {}) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
    text: async () => (body === undefined || body === null ? "" : JSON.stringify(body)),
  })) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("guest, tenant, and stay registration repositories", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the new repository contract type-safe", () => {
    const guestRequests: GuestRequestRepository = {
      getAll: async () => [guestRequest],
      getById: async () => guestRequest,
      getByPropertyId: async (_propertyId: string) => [guestRequest],
      create: async (_input: GuestRequestCreateInput) => guestRequest,
      update: async (_id: string, _input: GuestRequestUpdateInput) => guestRequest,
      transitionStatus: async (_id: string, _status: GuestRequestStatus, _assignedTo?: string | null) => guestRequest,
      delete: async (_id: string) => {},
    };

    const tenantRepository: TenantRepository = {
      getAll: async (_propertyId: string, _filters?: { status?: TenantStatus }) => [tenant],
      getById: async (_id: string) => tenant,
      create: async (_input: TenantCreateInput) => tenant,
      update: async (_id: string, _input: TenantUpdateInput) => tenant,
      delete: async (_id: string) => {},
    };

    const stayRegistrationRepository: StayRegistrationRepository = {
      getAll: async (_propertyId: string, _filters?: { tenant_id?: string | null; room_id?: string | null }) => [stayRegistration],
      getById: async (_id: string) => stayRegistration,
      create: async (_input: StayRegistrationCreateInput) => stayRegistration,
      update: async (_id: string, _input: StayRegistrationUpdateInput) => stayRegistration,
      delete: async (_id: string) => {},
    };

    const factory: RepositoryFactory = {
      dashboard: {} as RepositoryFactory["dashboard"],
      properties: {} as RepositoryFactory["properties"],
      rooms: {} as RepositoryFactory["rooms"],
      reservations: {} as RepositoryFactory["reservations"],
      guestRequests,
      tenantRepository,
      stayRegistrationRepository,
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
    };

    void guestRequests;
    void tenantRepository;
    void stayRegistrationRepository;
    void factory;
    void guestRequest;
    void tenant;
    void stayRegistration;
  });

  it("builds the planned REST requests", async () => {
    const fetchMock = mockFetch(true, guestRequest);
    const repos = createRestRepositories();

    expect(repos.tenantRepository).toBeDefined();
    expect(repos.stayRegistrationRepository).toBeDefined();

    await repos.guestRequests.create({
      guest_id: "guest-1",
      room_id: "room-1",
      request_type: "Towel",
      notes: "Need towels",
      is_completed: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/guest-requests"),
      expect.objectContaining({ method: "POST" })
    );

    await repos.guestRequests.update("guest-request-1", {
      guest_id: "guest-1",
      room_id: "room-1",
      request_type: "Towel",
      notes: "Need towels",
      is_completed: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/guest-requests/guest-request-1"),
      expect.objectContaining({ method: "PUT" })
    );

    await repos.guestRequests.transitionStatus("guest-request-1", "assigned", "user-1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/guest-requests/guest-request-1/status"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "assigned", assigned_to: "user-1" }),
      })
    );

    await repos.guestRequests.delete("guest-request-1");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/guest-requests/guest-request-1"),
      expect.objectContaining({ method: "DELETE" })
    );

    await repos.tenantRepository.create({
      property_id: "property-1",
      name: "Tenant A",
      id_document_type: "passport",
      id_document_number: "P123",
      lease_start: "2026-01-01",
      lease_end: "2026-12-31",
      monthly_rent: 1000,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/tenants"),
      expect.objectContaining({ method: "POST" })
    );

    await repos.stayRegistrationRepository.getAll("property-1", { tenant_id: "tenant-1", room_id: "room-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/stay-registrations?property_id=property-1&tenant_id=tenant-1&room_id=room-1")
    );
  });
});
