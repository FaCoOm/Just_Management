/**
 * Stable query keys for dashboard / repository-backed server state.
 */
const root = ["dashboard"] as const;

export const dashboardKeys = {
  all: root,
  summary: (date: string) => [...root, "summary", date] as const,
  properties: [...root, "properties"] as const,
  rooms: [...root, "rooms"] as const,
  reservations: [...root, "reservations"] as const,
  guestRequests: [...root, "guestRequests"] as const,
  guestRequestsByProperty: (
    propertyId: string,
    status = "all",
    priority = "all",
    assignedTo = "all"
  ) => [...root, "guestRequests", propertyId, status, priority, assignedTo] as const,
  tenants: [...root, "tenants"] as const,
  tenantsByProperty: (propertyId: string, status = "all") =>
    [...root, "tenants", propertyId, status] as const,
  stayRegistrations: [...root, "stayRegistrations"] as const,
  stayRegistrationsByProperty: (
    propertyId: string,
    tenantId = "all",
    roomId = "all"
  ) => [...root, "stayRegistrations", propertyId, tenantId, roomId] as const,
  maintenance: [...root, "maintenance"] as const,
  diningEvents: [...root, "diningEvents"] as const,
  staff: [...root, "staff"] as const,
  securityAudit: [...root, "securityAudit"] as const,
  rates: (startDate: string, endDate: string, propertyId = "all") =>
    [...root, "rates", startDate, endDate, propertyId] as const,
  arrivalsByDate: (date: string) => [...root, "arrivalsByDate", date] as const,
  departuresByDate: (date: string) =>
    [...root, "departuresByDate", date] as const,
  occupancyStats: (days: number, endDate: string, propertyId = "all") =>
    [...root, "occupancyStats", days, endDate, propertyId] as const,
};
