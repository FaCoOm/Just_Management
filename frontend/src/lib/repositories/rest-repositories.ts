/**
 * REST API implementation of repository interfaces (Track B).
 * Calls the Express/Prisma backend instead of Supabase.
 */
import type {
  PropertyRepository,
  DashboardRepository,
  RoomRepository,
  ReservationRepository,
  GuestRequestRepository,
  TenantRepository,
  StayRegistrationRepository,
  MaintenanceRepository,
  ChannelRepository,
  DiningEventRepository,
  IngestRepository,
  IntegrationRepository,
  RateRepository,
  RepositoryFactory,
  SecurityAuditRepository,
  StatsRepository,
  StaffRepository,
  TaxExportRepository,
} from "./types";
import type { ReservationCreateInput, RoomStatus } from "@/types/database";

type FetchFn = typeof fetch;

// Use the global fetch API (Node 18+ or browser).
// In Vite dev, calls are proxied; in production, point at the deployed API.
const apiFetch: FetchFn = (...args) => fetch(...args);

function apiUrl(path: string): string {
  const base = import.meta.env.VITE_TRACK_B_API_URL ?? "";
  return `${base}${path}`;
}

function withQuery(
  path: string,
  params: Record<string, string | number | undefined>
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await apiFetch(apiUrl(path));
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${path}`);
  }
  return res.json();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data;
}

async function putJson<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(apiUrl(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(apiUrl(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data;
}

async function deleteJson<T>(path: string): Promise<T> {
  const res = await apiFetch(apiUrl(path), { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${path}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  return text ? JSON.parse(text) as T : undefined as T;
}

async function postForm<T>(path: string, body: FormData): Promise<T> {
  const res = await apiFetch(apiUrl(path), { method: "POST", body });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data;
}

// Property repository implementation
const dashboardRepo: DashboardRepository = {
  async getSummary(date, days, propertyId) {
    return getJson(
      withQuery("/api/dashboard/summary", {
        date,
        days,
        property_id: propertyId,
      })
    );
  },
};

// Property repository implementation
const propertyRepo: PropertyRepository = {
  async getAll() {
    return getJson("/api/properties");
  },
  async getById(id) {
    const res = await apiFetch(apiUrl(`/api/properties/${id}`));
    return res.ok ? res.json() : null;
  },
};

// Room repository implementation
const roomRepo: RoomRepository = {
  async getAll() {
    return getJson("/api/rooms");
  },
  async getById(id) {
    const res = await apiFetch(apiUrl(`/api/rooms/${id}`));
    return res.ok ? res.json() : null;
  },
  async getByPropertyId(propertyId) {
    return getJson(`/api/rooms?property_id=${propertyId}`);
  },
  async updateStatus(roomId: string, status: RoomStatus) {
    return patchJson(`/api/rooms/${roomId}/status`, { status });
  },
};

// Reservation repository implementation
const reservationRepo: ReservationRepository = {
  async create(input: ReservationCreateInput) {
    return postJson("/api/reservations", input);
  },
  async getAll() {
    return getJson("/api/reservations");
  },
  async getById(id) {
    const res = await apiFetch(apiUrl(`/api/reservations/${id}`));
    return res.ok ? res.json() : null;
  },
  async getByPropertyId(propertyId) {
    return getJson(`/api/reservations?property_id=${propertyId}`);
  },
  async getByDateRange(startDate, endDate) {
    return getJson(`/api/reservations?start_date=${startDate}&end_date=${endDate}`);
  },
  async getByStatus(statuses) {
    // Pass first status as primary filter; backend can be extended for multi-status
    return getJson(`/api/reservations?status=${statuses[0]}`);
  },
  async getByCheckInDate(date) {
    return getJson(withQuery("/api/reservations", { check_in_date: date }));
  },
  async getByCheckOutDate(date) {
    return getJson(withQuery("/api/reservations", { check_out_date: date }));
  },
};

// Guest request repository implementation
const guestRequestRepo: GuestRequestRepository = {
  async getAll() {
    return getJson("/api/guest-requests");
  },
  async getById(id) {
    const res = await apiFetch(apiUrl(`/api/guest-requests/${id}`));
    return res.ok ? res.json() : null;
  },
  async getByPropertyId(propertyId) {
    return getJson(`/api/guest-requests?property_id=${propertyId}`);
  },
  async create(input) {
    return postJson("/api/guest-requests", input);
  },
  async update(id, input) {
    return putJson(`/api/guest-requests/${id}`, input);
  },
  async transitionStatus(id, status, assigned_to) {
    return patchJson(`/api/guest-requests/${id}/status`, { status, assigned_to });
  },
  async delete(id) {
    await deleteJson(`/api/guest-requests/${id}`);
  },
};

const tenantRepo: TenantRepository = {
  async getAll(propertyId, filters) {
    return getJson(withQuery("/api/tenants", {
      property_id: propertyId,
      status: filters?.status,
    }));
  },
  async getById(id) {
    const res = await apiFetch(apiUrl(`/api/tenants/${id}`));
    return res.ok ? res.json() : null;
  },
  async create(input) {
    return postJson("/api/tenants", input);
  },
  async update(id, input) {
    return putJson(`/api/tenants/${id}`, input);
  },
  async delete(id) {
    await deleteJson(`/api/tenants/${id}`);
  },
};

const stayRegistrationRepo: StayRegistrationRepository = {
  async getAll(propertyId, filters) {
    return getJson(withQuery("/api/stay-registrations", {
      property_id: propertyId,
      tenant_id: filters?.tenant_id ?? undefined,
      room_id: filters?.room_id ?? undefined,
    }));
  },
  async getById(id) {
    const res = await apiFetch(apiUrl(`/api/stay-registrations/${id}`));
    return res.ok ? res.json() : null;
  },
  async create(input) {
    return postJson("/api/stay-registrations", input);
  },
  async update(id, input) {
    return putJson(`/api/stay-registrations/${id}`, input);
  },
  async delete(id) {
    await deleteJson(`/api/stay-registrations/${id}`);
  },
};

// Maintenance repository implementation
const maintenanceRepo: MaintenanceRepository = {
  async create(input) {
    return postJson("/api/maintenance", input);
  },
  async getAll() {
    return getJson("/api/maintenance");
  },
  async getById(id) {
    const res = await apiFetch(apiUrl(`/api/maintenance/${id}`));
    return res.ok ? res.json() : null;
  },
  async getByPropertyId(propertyId) {
    return getJson(`/api/maintenance?property_id=${propertyId}`);
  },
  async getOpenIssues() {
    return getJson("/api/maintenance?status=Open");
  },
};

const channelRepo: ChannelRepository = {
  async getAll() {
    return getJson("/api/channels");
  },
};

const diningEventRepo: DiningEventRepository = {
  async getAll() {
    return getJson("/api/dining-events");
  },
  async getByPropertyId(propertyId) {
    return getJson(withQuery("/api/dining-events", { property_id: propertyId }));
  },
};

const staffRepo: StaffRepository = {
  async getAll() {
    return getJson("/api/staff");
  },
};

const securityAuditRepo: SecurityAuditRepository = {
  async getAll() {
    return getJson("/api/security/audit");
  },
};

const rateRepo: RateRepository = {
  async getByDateRange(startDate, endDate, propertyId) {
    return getJson(withQuery("/api/rates", {
      start_date: startDate,
      end_date: endDate,
      property_id: propertyId,
    }));
  },
};

const taxExportRepo: TaxExportRepository = {
  async getPreview(date) {
    return getJson(withQuery("/api/tax-export/preview", { date }));
  },
  async getJobs() {
    return getJson("/api/tax-export/jobs");
  },
  async getSettings() {
    return getJson("/api/tax-export/settings");
  },
  async getJob(jobId) {
    return getJson(`/api/tax-export/jobs/${jobId}`);
  },
  async patchItem(id, body) {
    return patchJson(`/api/tax-export/items/${id}`, body);
  },
  async run(body) {
    return postJson("/api/tax-export/run", body);
  },
  async updateSettings(settings) {
    return putJson("/api/tax-export/settings", settings);
  },
  getDownloadUrl(params) {
    if (params.jobId) {
      return apiUrl(withQuery("/api/tax-export/download", { job_id: params.jobId }));
    }

    return apiUrl(withQuery("/api/tax-export/download", { date: params.date }));
  },
};

const DEV_USER_ID = "dev-admin-1";

const integrationHeaders = { "x-user-id": DEV_USER_ID };

const integrationRepo: IntegrationRepository = {
  async getStatus() {
    return getJson("/api/integrations/status");
  },
  async getConnections() {
    const res = await apiFetch(apiUrl("/api/one/connections"), { headers: integrationHeaders });
    const data = await res.json() as { connections: Awaited<ReturnType<IntegrationRepository["getConnections"]>> };
    if (!res.ok) throw new Error(`Connections failed: ${res.status}`);
    return data.connections;
  },
  async persistConnection(payload) {
    const res = await apiFetch(apiUrl("/api/one/connections"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...integrationHeaders },
      body: JSON.stringify({ userId: DEV_USER_ID, identityType: "user", ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Persist connection failed: ${res.status}`);
    return data;
  },
  async disconnect(connectionKey) {
    const res = await apiFetch(apiUrl(`/api/one/connections/${encodeURIComponent(connectionKey)}`), {
      method: "DELETE",
      headers: integrationHeaders,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Disconnect failed: ${res.status}`);
    return data;
  },
};

const ingestRepo: IngestRepository = {
  async getPipelineStatus() {
    return getJson("/api/ingest/pipeline/status");
  },

  async runBuiltInListingsSync() {
    return postJson("/api/ingest/pipeline/run", {
      mode: "built-in",
      targetKind: "listings",
      dryRun: false,
    });
  },

  async uploadReservations(formData) {
    return postForm("/api/ingest/reservations", formData);
  },
};

const statsRepo: StatsRepository = {
  async getOccupancy(days, endDate, propertyId) {
    return getJson(
      withQuery("/api/stats/occupancy", {
        days,
        end_date: endDate,
        property_id: propertyId,
      })
    );
  },
};

// Repository factory for Track B (REST API)
export const createRestRepositories = (): RepositoryFactory => ({
  dashboard: dashboardRepo,
  properties: propertyRepo,
  rooms: roomRepo,
  reservations: reservationRepo,
  guestRequests: guestRequestRepo,
  tenantRepository: tenantRepo,
  stayRegistrationRepository: stayRegistrationRepo,
  maintenance: maintenanceRepo,
  stats: statsRepo,
  channels: channelRepo,
  taxExport: taxExportRepo,
  integrations: integrationRepo,
  ingest: ingestRepo,
  diningEvents: diningEventRepo,
  staff: staffRepo,
  securityAudit: securityAuditRepo,
  rates: rateRepo,
});
