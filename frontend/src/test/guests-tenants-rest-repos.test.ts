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
    expect(repos.stayExperiences.getAll).toBeTypeOf("function");
    expect(repos.stayExperiences.create).toBeTypeOf("function");
    expect(repos.folios.getByReservationId).toBeTypeOf("function");
    expect(repos.folios.addLineItem).toBeTypeOf("function");
    expect(repos.folios.recordPayment).toBeTypeOf("function");
    expect(repos.checkInOut.checkIn).toBeTypeOf("function");
    expect(repos.checkInOut.checkOut).toBeTypeOf("function");
    expect(repos.diningEvents.create).toBeTypeOf("function");
    expect(repos.staff.create).toBeTypeOf("function");
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
    expect(updateInit?.method).toBe("PATCH");
    expect(updateInit?.body).toBe(JSON.stringify(updatePayload));

    const [statusInput, statusInit] = getCall(fetchMock, 2);
    expect(getPath(statusInput).pathname).toBe("/api/guest-requests/guest-request-1/status");
    expect(statusInit?.method).toBe("PATCH");
    expect(statusInit?.body).toBe(JSON.stringify({ status: "assigned", assigned_to: "user-1" }));

    const [deleteInput, deleteInit] = getCall(fetchMock, 3);
    expect(getPath(deleteInput).pathname).toBe("/api/guest-requests/guest-request-1");
    expect(deleteInit?.method).toBe("DELETE");
  });

  it("builds operations pipeline REST calls", async () => {
    const fetchMock = createFetchStub([
      createJsonResponse([{ id: "stay-experience-1" }]),
      createJsonResponse({ id: "stay-experience-1" }),
      createJsonResponse({ id: "folio-1" }),
      createJsonResponse({ id: "folio-1" }),
      createJsonResponse({ id: "folio-1" }),
      createJsonResponse({ reservation: { id: "reservation-1" }, folio: { id: "folio-1" } }),
      createJsonResponse({ reservation: { id: "reservation-1" }, folio: { id: "folio-1" } }),
      createJsonResponse({ id: "event-1" }),
      createJsonResponse({ id: "staff-1" }),
    ]);

    const repos = createRestRepositories();
    const stayPayload = {
      reservation_id: "reservation-1",
      stay_type: "short_term" as const,
      experience_notes: "Quiet stay",
      guest_request_content: "Extra towel",
    };
    const lineItemPayload = { description: "Room charge", kind: "charge" as const, quantity: 2, unit_amount: 100 };
    const paymentPayload = { method: "Cash", amount: 200, reference: "receipt-1" };
    const diningPayload = {
      title: "Dinner",
      type: "dinner" as const,
      venue: "Rooftop",
      date: "2026-06-19",
      start_time: "18:00",
      end_time: "20:00",
      guest_count: 4,
      guest_name: "Guest A",
      property_id: "property-1",
      status: "confirmed" as const,
      notes: "Window table",
    };
    const staffPayload = {
      name: "Staff A",
      email: "staff@example.com",
      role: "staff" as const,
      property_ids: ["property-1"],
      status: "active" as const,
    };

    await repos.stayExperiences.getAll("property-1", { stay_type: "short_term" });
    await repos.stayExperiences.create(stayPayload);
    await repos.folios.getByReservationId("reservation-1");
    await repos.folios.addLineItem("folio-1", lineItemPayload);
    await repos.folios.recordPayment("folio-1", paymentPayload);
    await repos.checkInOut.checkIn("reservation-1");
    await repos.checkInOut.checkOut("reservation-1");
    await repos.diningEvents.create(diningPayload);
    await repos.staff.create(staffPayload);

    const [stayListInput] = getCall(fetchMock, 0);
    const stayListUrl = getPath(stayListInput);
    expect(stayListUrl.pathname).toBe("/api/stay-experiences");
    expect(stayListUrl.searchParams.get("property_id")).toBe("property-1");
    expect(stayListUrl.searchParams.get("stay_type")).toBe("short_term");

    const [stayCreateInput, stayCreateInit] = getCall(fetchMock, 1);
    expect(getPath(stayCreateInput).pathname).toBe("/api/stay-experiences");
    expect(stayCreateInit?.method).toBe("POST");
    expect(stayCreateInit?.body).toBe(JSON.stringify(stayPayload));

    const [folioInput] = getCall(fetchMock, 2);
    const folioUrl = getPath(folioInput);
    expect(folioUrl.pathname).toBe("/api/folios");
    expect(folioUrl.searchParams.get("reservation_id")).toBe("reservation-1");

    const [lineItemInput, lineItemInit] = getCall(fetchMock, 3);
    expect(getPath(lineItemInput).pathname).toBe("/api/folios/folio-1/line-items");
    expect(lineItemInit?.method).toBe("POST");
    expect(lineItemInit?.body).toBe(JSON.stringify(lineItemPayload));

    const [paymentInput, paymentInit] = getCall(fetchMock, 4);
    expect(getPath(paymentInput).pathname).toBe("/api/folios/folio-1/payments");
    expect(paymentInit?.method).toBe("POST");
    expect(paymentInit?.body).toBe(JSON.stringify(paymentPayload));

    const [checkInInput, checkInInit] = getCall(fetchMock, 5);
    expect(getPath(checkInInput).pathname).toBe("/api/reservations/reservation-1/check-in");
    expect(checkInInit?.method).toBe("POST");

    const [checkOutInput, checkOutInit] = getCall(fetchMock, 6);
    expect(getPath(checkOutInput).pathname).toBe("/api/reservations/reservation-1/check-out");
    expect(checkOutInit?.method).toBe("POST");

    const [diningInput, diningInit] = getCall(fetchMock, 7);
    expect(getPath(diningInput).pathname).toBe("/api/dining-events");
    expect(diningInit?.method).toBe("POST");
    expect(diningInit?.body).toBe(JSON.stringify(diningPayload));

    const [staffInput, staffInit] = getCall(fetchMock, 8);
    expect(getPath(staffInput).pathname).toBe("/api/staff");
    expect(staffInit?.method).toBe("POST");
    expect(staffInit?.body).toBe(JSON.stringify(staffPayload));
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
