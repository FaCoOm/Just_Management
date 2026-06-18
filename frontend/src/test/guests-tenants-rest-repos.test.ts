import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRestRepositories } from "../lib/repositories/rest-repositories";

type FetchCall = [input: RequestInfo | URL, init?: RequestInit];

function createJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function createFetchStub(responses: Response[]) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const next = responses.shift();

    if (!next) {
      throw new Error("No mocked fetch response remaining");
    }

    return next;
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function getCall(mock: ReturnType<typeof vi.fn>, index: number): FetchCall {
  const call = mock.mock.calls[index];

  if (!call) {
    throw new Error(`Missing fetch call at index ${index}`);
  }

  return call as FetchCall;
}

function getPath(input: RequestInfo | URL) {
  return new URL(String(input), "http://localhost");
}

describe("createRestRepositories guest/tenant adapters", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes the planned repository methods", () => {
    const repos = createRestRepositories();

    expect(repos.tenantRepository).toBeDefined();
    expect(repos.stayRegistrationRepository).toBeDefined();
    expect(repos.guestRequests.create).toBeTypeOf("function");
    expect(repos.guestRequests.update).toBeTypeOf("function");
    expect(repos.guestRequests.transitionStatus).toBeTypeOf("function");
    expect(repos.guestRequests.delete).toBeTypeOf("function");
    expect(repos.tenantRepository.getAll).toBeTypeOf("function");
    expect(repos.tenantRepository.getById).toBeTypeOf("function");
    expect(repos.tenantRepository.create).toBeTypeOf("function");
    expect(repos.tenantRepository.update).toBeTypeOf("function");
    expect(repos.tenantRepository.delete).toBeTypeOf("function");
    expect(repos.stayRegistrationRepository.getAll).toBeTypeOf("function");
    expect(repos.stayRegistrationRepository.getById).toBeTypeOf("function");
    expect(repos.stayRegistrationRepository.create).toBeTypeOf("function");
    expect(repos.stayRegistrationRepository.update).toBeTypeOf("function");
    expect(repos.stayRegistrationRepository.delete).toBeTypeOf("function");
  });

  it("builds guest request lifecycle REST calls", async () => {
    const fetchMock = createFetchStub([
      createJsonResponse({ id: "guest-request-1" }),
      createJsonResponse({ id: "guest-request-1" }),
      createJsonResponse({ id: "guest-request-1", status: "assigned" }),
      new Response(null, { status: 204 }),
    ]);

    const repos = createRestRepositories();

    const createPayload = {
      guest_id: "guest-1",
      reservation_id: "reservation-1",
      property_id: "property-1",
      room_id: "room-1",
      request_type: "Towel",
      notes: "Need towels",
      is_completed: false,
      status: "open" as const,
      priority: "medium" as const,
      assigned_to: null,
      description: "Bring two fresh towels",
    };

    const updatePayload = {
      notes: "Bring towels and water",
      priority: "high" as const,
    };

    await repos.guestRequests.create(createPayload);
    await repos.guestRequests.update("guest-request-1", updatePayload);
    await repos.guestRequests.transitionStatus("guest-request-1", "assigned", "user-1");
    await repos.guestRequests.delete("guest-request-1");

    const [createInput, createInit] = getCall(fetchMock, 0);
    expect(getPath(createInput).pathname).toBe("/api/guest-requests");
    expect(createInit?.method).toBe("POST");
    expect(createInit?.body).toBe(JSON.stringify(createPayload));

    const [updateInput, updateInit] = getCall(fetchMock, 1);
    expect(getPath(updateInput).pathname).toBe("/api/guest-requests/guest-request-1");
    expect(updateInit?.method).toBe("PUT");
    expect(updateInit?.body).toBe(JSON.stringify(updatePayload));

    const [statusInput, statusInit] = getCall(fetchMock, 2);
    expect(getPath(statusInput).pathname).toBe("/api/guest-requests/guest-request-1/status");
    expect(statusInit?.method).toBe("PATCH");
    expect(statusInit?.body).toBe(JSON.stringify({ status: "assigned", assigned_to: "user-1" }));

    const [deleteInput, deleteInit] = getCall(fetchMock, 3);
    expect(getPath(deleteInput).pathname).toBe("/api/guest-requests/guest-request-1");
    expect(deleteInit?.method).toBe("DELETE");
  });

  it("builds tenant repository REST calls", async () => {
    const fetchMock = createFetchStub([
      createJsonResponse([{ id: "tenant-1" }]),
      createJsonResponse({ id: "tenant-1" }),
      createJsonResponse({ id: "tenant-1" }),
      createJsonResponse({ id: "tenant-1" }),
      new Response(null, { status: 204 }),
    ]);

    const repos = createRestRepositories();

    const createPayload = {
      property_id: "property-1",
      name: "Tenant A",
      email: "tenant@example.com",
      phone: "+84123456789",
      id_document_type: "passport" as const,
      id_document_number: "P123",
      nationality: "VN",
      lease_start: "2026-01-01",
      lease_end: "2026-12-31",
      monthly_rent: 1000,
      deposit_amount: 200,
      emergency_contact_name: "Emergency Contact",
      emergency_contact_phone: "+84987654321",
      notes: "VIP tenant",
      status: "active" as const,
      is_vip: true,
    };

    const updatePayload = {
      status: "inactive" as const,
      notes: "Temporarily away",
    };

    await repos.tenantRepository.getAll("property-1", { status: "active" });
    await repos.tenantRepository.getById("tenant-1");
    await repos.tenantRepository.create(createPayload);
    await repos.tenantRepository.update("tenant-1", updatePayload);
    await repos.tenantRepository.delete("tenant-1");

    const [listInput] = getCall(fetchMock, 0);
    const listUrl = getPath(listInput);
    expect(listUrl.pathname).toBe("/api/tenants");
    expect(listUrl.searchParams.get("property_id")).toBe("property-1");
    expect(listUrl.searchParams.get("status")).toBe("active");

    const [byIdInput] = getCall(fetchMock, 1);
    expect(getPath(byIdInput).pathname).toBe("/api/tenants/tenant-1");

    const [createInput, createInit] = getCall(fetchMock, 2);
    expect(getPath(createInput).pathname).toBe("/api/tenants");
    expect(createInit?.method).toBe("POST");
    expect(createInit?.body).toBe(JSON.stringify(createPayload));

    const [updateInput, updateInit] = getCall(fetchMock, 3);
    expect(getPath(updateInput).pathname).toBe("/api/tenants/tenant-1");
    expect(updateInit?.method).toBe("PUT");
    expect(updateInit?.body).toBe(JSON.stringify(updatePayload));

    const [deleteInput, deleteInit] = getCall(fetchMock, 4);
    expect(getPath(deleteInput).pathname).toBe("/api/tenants/tenant-1");
    expect(deleteInit?.method).toBe("DELETE");
  });

  it("builds stay registration REST calls", async () => {
    const fetchMock = createFetchStub([
      createJsonResponse([{ id: "stay-registration-1" }]),
      createJsonResponse({ id: "stay-registration-1" }),
      createJsonResponse({ id: "stay-registration-1" }),
      createJsonResponse({ id: "stay-registration-1" }),
      new Response(null, { status: 204 }),
    ]);

    const repos = createRestRepositories();

    const createPayload = {
      property_id: "property-1",
      tenant_id: "tenant-1",
      room_id: "room-1",
      guest_name: "Guest A",
      guest_count: 2,
      registration_date: "2026-06-17",
      registration_number: "REG-001",
      drive_folder_id: "drive-folder-1",
      drive_folder_status: "created" as const,
      notes: "Late arrival",
    };

    const updatePayload = {
      room_id: "room-2",
      notes: "Moved rooms",
    };

    await repos.stayRegistrationRepository.getAll("property-1", {
      tenant_id: "tenant-1",
      room_id: "room-1",
    });
    await repos.stayRegistrationRepository.getById("stay-registration-1");
    await repos.stayRegistrationRepository.create(createPayload);
    await repos.stayRegistrationRepository.update("stay-registration-1", updatePayload);
    await repos.stayRegistrationRepository.delete("stay-registration-1");

    const [listInput] = getCall(fetchMock, 0);
    const listUrl = getPath(listInput);
    expect(listUrl.pathname).toBe("/api/stay-registrations");
    expect(listUrl.searchParams.get("property_id")).toBe("property-1");
    expect(listUrl.searchParams.get("tenant_id")).toBe("tenant-1");
    expect(listUrl.searchParams.get("room_id")).toBe("room-1");

    const [byIdInput] = getCall(fetchMock, 1);
    expect(getPath(byIdInput).pathname).toBe("/api/stay-registrations/stay-registration-1");

    const [createInput, createInit] = getCall(fetchMock, 2);
    expect(getPath(createInput).pathname).toBe("/api/stay-registrations");
    expect(createInit?.method).toBe("POST");
    expect(createInit?.body).toBe(JSON.stringify(createPayload));

    const [updateInput, updateInit] = getCall(fetchMock, 3);
    expect(getPath(updateInput).pathname).toBe("/api/stay-registrations/stay-registration-1");
    expect(updateInit?.method).toBe("PUT");
    expect(updateInit?.body).toBe(JSON.stringify(updatePayload));

    const [deleteInput, deleteInit] = getCall(fetchMock, 4);
    expect(getPath(deleteInput).pathname).toBe("/api/stay-registrations/stay-registration-1");
    expect(deleteInit?.method).toBe("DELETE");
  });
});
