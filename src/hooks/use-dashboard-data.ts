import { useEffect, useState } from "react";
import { createSupabaseRepositories } from "@/lib/repositories";
import type {
  Property,
  Room,
  Guest,
  GuestRequest,
  MaintenanceIssue,
  PropertyMetrics,
  Reservation,
  ReservationStatus,
} from "@/types/database";

// Repository factory - swap createSupabaseRepositories() for Track B equivalent
const repos = createSupabaseRepositories();

const ARRIVAL_RESERVATION_STATUSES: ReservationStatus[] = [
  "pending",
  "check_in_pending",
];

const DEPARTURE_RESERVATION_STATUSES: ReservationStatus[] = [
  "check_out_pending",
];

const LEGACY_BOOKING_SOURCE_PATTERN = /booking_source=([^;]+)/i;
const LEGACY_VIP_PATTERN = /is_vip=true/i;

function toCompatibilityDate(date: string) {
  return `${date}T00:00:00`;
}

function toCompatibilityStatus(status: ReservationStatus): Guest["check_in_status"] {
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
  const source = reservation.operational_notes.match(LEGACY_BOOKING_SOURCE_PATTERN)?.[1]?.trim();
  return source || "Reservation";
}

function toDashboardGuest(reservation: Reservation): Guest {
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
    is_vip: LEGACY_VIP_PATTERN.test(reservation.operational_notes),
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
  totals: {
    arrivals: number;
    departures: number;
    occupancyRate: number;
    maintenanceOpen: number;
  };
  loading: boolean;
}

export function useDashboardData(): DashboardData {
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [requests, setRequests] = useState<GuestRequest[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceIssue[]>([]);
  const [loading, setLoading] = useState(true);

useEffect(() => {
    async function fetchAll() {
      const [propRes, roomRes, reservationRes, reqRes, maintRes] = await Promise.all([
        repos.properties.getAll(),
        repos.rooms.getAll(),
        repos.reservations.getAll(),
        repos.guestRequests.getAll(),
        repos.maintenance.getAll(),
      ]);

      setProperties(propRes);
      setRooms(roomRes);
      setReservations(reservationRes);
      setRequests(reqRes);
      setMaintenance(maintRes);
      setLoading(false);
    }

    fetchAll();
  }, []);

  const guests = reservations.map(toDashboardGuest);

  const metrics: PropertyMetrics[] = properties.map((prop) => {
    const propRooms = rooms.filter((r) => r.property_id === prop.id);
    const propReservations = reservations.filter((r) => r.property_id === prop.id);
    const propMaint = maintenance.filter((m) => m.property_id === prop.id);

    const occupied = propRooms.filter((r) =>
      ["Occupied", "Checked In", "Check-Out Pending"].includes(r.status)
    ).length;

    const totalRooms = propRooms.length || prop.total_rooms || 1;

    return {
      property: prop,
      arrivals: propReservations.filter((r) =>
        ARRIVAL_RESERVATION_STATUSES.includes(r.status)
      ).length,
      departures: propReservations.filter((r) =>
        DEPARTURE_RESERVATION_STATUSES.includes(r.status)
      ).length,
      occupancyRate: Math.round((occupied / totalRooms) * 100),
      occupiedRooms: occupied,
      maintenanceOpen: propMaint.filter((m) => m.status !== "Resolved").length,
    };
  });

  const totals = {
    arrivals: metrics.reduce((sum, m) => sum + m.arrivals, 0),
    departures: metrics.reduce((sum, m) => sum + m.departures, 0),
    occupancyRate:
      metrics.length > 0
        ? Math.round(
            metrics.reduce((sum, m) => sum + m.occupancyRate, 0) / metrics.length
          )
        : 0,
    maintenanceOpen: metrics.reduce((sum, m) => sum + m.maintenanceOpen, 0),
  };

  return {
    properties,
    rooms,
    reservations,
    guests,
    requests,
    maintenance,
    metrics,
    totals,
    loading,
  };
}
