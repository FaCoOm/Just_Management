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
