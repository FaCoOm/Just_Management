import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createRestRepositories } from "@/lib/repositories";
import { dashboardKeys } from "@/lib/query-keys";
import type {
  Property,
  Room,
  Guest,
  GuestRequest,
  MaintenanceIssue,
  OccupancySeriesPoint,
  PropertyMetrics,
  Reservation,
  ReservationStatus,
} from "@/types/database";

const LEGACY_BOOKING_SOURCE_PATTERN = /booking_source=([^;]+)/i;
const LEGACY_VIP_PATTERN = /is_vip=true/i;

function toCompatibilityDate(date: string) {
  if (!date) return null;
  return date.includes("T") ? date : `${date}T00:00:00`;
}

function toCompatibilityStatus(
  status: ReservationStatus
): Guest["check_in_status"] {
  switch (status) {
    case "check_in_pending":
      return "Check-In Pending";
    case "checked_in":
      return "Checked In";
    case "check_out_pending":
      return "Check-Out Pending";
    case "checked_out":
    case "cancelled":
    case "no_show":
      return "Checked Out";
    case "pending":
    default:
      return "Pending";
  }
}

function getCompatibilityBookingSource(reservation: Reservation) {
  const source = (reservation.operational_notes || "")
    .match(LEGACY_BOOKING_SOURCE_PATTERN)?.[1]
    ?.trim();
  return source || "Reservation";
}

export function toDashboardGuest(reservation: Reservation): Guest {
  return {
    id: reservation.id,
    reservation_id: reservation.id,
    property_id: reservation.property_id,
    room_id: reservation.primary_room_id,
    guest_name: reservation.guest_name,
    eta: toCompatibilityDate(reservation.check_in_date),
    etd: toCompatibilityDate(reservation.check_out_date),
    check_in_status: toCompatibilityStatus(reservation.status),
    booking_source: getCompatibilityBookingSource(reservation),
    is_vip: LEGACY_VIP_PATTERN.test(reservation.operational_notes || ""),
    guest_count: reservation.guest_count,
    created_at: reservation.created_at,
  };
}

interface DashboardData {
  properties: Property[];
  rooms: Room[];
  reservations: Reservation[];
  guests: Guest[];
  requests: GuestRequest[];
  maintenance: MaintenanceIssue[];
  metrics: PropertyMetrics[];
  todayArrivals: Guest[];
  todayDepartures: Guest[];
  todayCheckouts: Guest[];
  totals: {
    arrivals: number;
    departures: number;
    occupancyRate: number;
    maintenanceOpen: number;
  };
  occupancySeries: OccupancySeriesPoint[];
  loading: boolean;
}

export function useDashboardData(today: string): DashboardData {
  const repos = useMemo(() => createRestRepositories(), []);
  const { data, isPending } = useQuery({
    queryKey: dashboardKeys.summary(today),
    queryFn: () => repos.dashboard.getSummary(today, 30),
  });

  const properties = data?.properties ?? [];
  const rooms = data?.rooms ?? [];
  const reservations = data?.reservations ?? [];
  const guests = data?.guests ?? [];
  const requests = data?.requests ?? [];
  const maintenance = data?.maintenance ?? [];
  const metrics = data?.metrics ?? [];
  const todayArrivals = data?.todayArrivals ?? [];
  const todayDepartures = data?.todayDepartures ?? [];
  const todayCheckouts = data?.todayCheckouts ?? [];
  const totals = data?.totals ?? {
    arrivals: 0,
    departures: 0,
    occupancyRate: 0,
    maintenanceOpen: 0,
  };
  const occupancySeries = data?.occupancySeries ?? [];

  return {
    properties,
    rooms,
    reservations,
    guests,
    requests,
    maintenance,
    metrics,
    todayArrivals,
    todayDepartures,
    todayCheckouts,
    totals,
    occupancySeries,
    loading: isPending,
  };
}
