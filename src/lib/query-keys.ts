/**
 * Stable query keys for dashboard / repository-backed server state.
 */
const root = ["dashboard"] as const;

export const dashboardKeys = {
  all: root,
  properties: [...root, "properties"] as const,
  rooms: [...root, "rooms"] as const,
  reservations: [...root, "reservations"] as const,
  guestRequests: [...root, "guestRequests"] as const,
  maintenance: [...root, "maintenance"] as const,
  arrivalsByDate: (date: string) => [...root, "arrivalsByDate", date] as const,
  departuresByDate: (date: string) =>
    [...root, "departuresByDate", date] as const,
  occupancyStats: (days: number, endDate: string, propertyId = "all") =>
    [...root, "occupancyStats", days, endDate, propertyId] as const,
};
