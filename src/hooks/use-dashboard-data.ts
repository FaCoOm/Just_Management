import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { createRestRepositories } from "@/lib/repositories";
import { dashboardKeys } from "@/lib/query-keys";
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

const ARRIVAL_RESERVATION_STATUSES: ReservationStatus[] = [
  "pending",
  "check_in_pending",
];

const DEPARTURE_RESERVATION_STATUSES: ReservationStatus[] = [
  "check_out_pending",
];

const CHECKOUT_RESERVATION_STATUSES: ReservationStatus[] = [
  "check_out_pending",
  "checked_out",
];

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
    is_vip: LEGACY_VIP_PATTERN.test(reservation.operational_notes || ""),
    guest_count: reservation.guest_count,
    created_at: reservation.created_at,
  };
}

function filterByStatuses(
  reservations: Reservation[],
  statuses: ReservationStatus[]
) {
  return reservations.filter((reservation) => statuses.includes(reservation.status));
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
  loading: boolean;
}

export function useDashboardData(today: string): DashboardData {
  const repos = useMemo(() => createRestRepositories(), []);
  const results = useQueries({
    queries: [
      {
        queryKey: dashboardKeys.properties,
        queryFn: () => repos.properties.getAll(),
      },
      {
        queryKey: dashboardKeys.rooms,
        queryFn: () => repos.rooms.getAll(),
      },
      {
        queryKey: dashboardKeys.reservations,
        queryFn: () => repos.reservations.getAll(),
      },
      {
        queryKey: dashboardKeys.guestRequests,
        queryFn: () => repos.guestRequests.getAll(),
      },
      {
        queryKey: dashboardKeys.maintenance,
        queryFn: () => repos.maintenance.getAll(),
      },
      {
        queryKey: dashboardKeys.arrivalsByDate(today),
        queryFn: () => repos.reservations.getByCheckInDate(today),
      },
      {
        queryKey: dashboardKeys.departuresByDate(today),
        queryFn: () => repos.reservations.getByCheckOutDate(today),
      },
    ],
  });

  const loading = results.some((result) => result.isPending);

  const properties = (results[0].data ?? []) as Property[];
  const rooms = (results[1].data ?? []) as Room[];
  const reservations = (results[2].data ?? []) as Reservation[];
  const requests = (results[3].data ?? []) as GuestRequest[];
  const maintenance = (results[4].data ?? []) as MaintenanceIssue[];
  const arrivalsOnDate = (results[5].data ?? []) as Reservation[];
  const departuresOnDate = (results[6].data ?? []) as Reservation[];

  const guests = useMemo(() => reservations.map(toDashboardGuest), [reservations]);

  const todayArrivalReservations = useMemo(
    () => filterByStatuses(arrivalsOnDate, ARRIVAL_RESERVATION_STATUSES),
    [arrivalsOnDate]
  );
  const todayDepartureReservations = useMemo(
    () => filterByStatuses(departuresOnDate, DEPARTURE_RESERVATION_STATUSES),
    [departuresOnDate]
  );
  const todayCheckoutReservations = useMemo(
    () => filterByStatuses(departuresOnDate, CHECKOUT_RESERVATION_STATUSES),
    [departuresOnDate]
  );

  const todayArrivals = useMemo(
    () => todayArrivalReservations.map(toDashboardGuest),
    [todayArrivalReservations]
  );
  const todayDepartures = useMemo(
    () => todayDepartureReservations.map(toDashboardGuest),
    [todayDepartureReservations]
  );
  const todayCheckouts = useMemo(
    () => todayCheckoutReservations.map(toDashboardGuest),
    [todayCheckoutReservations]
  );

  const metrics: PropertyMetrics[] = useMemo(
    () =>
      properties.map((property) => {
        const propertyRooms = rooms.filter(
          (room) => room.property_id === property.id
        );
        const propertyMaintenance = maintenance.filter(
          (issue) => issue.property_id === property.id
        );

        const occupiedRooms = propertyRooms.filter((room) =>
          ["Occupied", "Checked In", "Check-Out Pending"].includes(room.status)
        ).length;
        const totalRooms = propertyRooms.length || property.total_rooms || 1;

        return {
          property,
          arrivals: todayArrivalReservations.filter(
            (reservation) => reservation.property_id === property.id
          ).length,
          departures: todayDepartureReservations.filter(
            (reservation) => reservation.property_id === property.id
          ).length,
          occupancyRate: Math.round((occupiedRooms / totalRooms) * 100),
          occupiedRooms,
          maintenanceOpen: propertyMaintenance.filter(
            (issue) => issue.status !== "Resolved"
          ).length,
        };
      }),
    [
      maintenance,
      properties,
      rooms,
      todayArrivalReservations,
      todayDepartureReservations,
    ]
  );

  const totals = useMemo(() => {
    const occupiedRooms = metrics.reduce(
      (sum, metric) => sum + metric.occupiedRooms,
      0
    );
    const totalRooms = properties.reduce((sum, property) => {
      const propertyRooms = rooms.filter((room) => room.property_id === property.id);
      return sum + (propertyRooms.length || property.total_rooms || 0);
    }, 0);

    return {
      arrivals: todayArrivals.length,
      departures: todayDepartures.length,
      occupancyRate:
        totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
      maintenanceOpen: metrics.reduce(
        (sum, metric) => sum + metric.maintenanceOpen,
        0
      ),
    };
  }, [metrics, properties, rooms, todayArrivals.length, todayDepartures.length]);

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
    loading,
  };
}
