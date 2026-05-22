import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { createRestRepositories } from "@/lib/repositories";
import { dashboardKeys } from "@/lib/query-keys";
import { toDashboardGuest } from "@/hooks/use-dashboard-data";
import type { Guest, MaintenanceIssue, Property, Reservation, Room } from "@/types/database";

const REFERENCE_STALE_TIME = 10 * 60_000;

interface ReservationPageData {
  properties: Property[];
  rooms: Room[];
  reservations: Reservation[];
  guests: Guest[];
  loading: boolean;
}

interface RoomsPageData {
  properties: Property[];
  rooms: Room[];
  guests: Guest[];
  loading: boolean;
}

interface MaintenancePageData {
  properties: Property[];
  rooms: Room[];
  maintenance: MaintenanceIssue[];
  loading: boolean;
}

export function useReservationsPageData(): ReservationPageData {
  const repos = useMemo(() => createRestRepositories(), []);
  const results = useQueries({
    queries: [
      {
        queryKey: dashboardKeys.properties,
        queryFn: () => repos.properties.getAll(),
        staleTime: REFERENCE_STALE_TIME,
      },
      {
        queryKey: dashboardKeys.rooms,
        queryFn: () => repos.rooms.getAll(),
        staleTime: REFERENCE_STALE_TIME,
      },
      {
        queryKey: dashboardKeys.reservations,
        queryFn: () => repos.reservations.getAll(),
      },
    ],
  });

  const properties = (results[0].data ?? []) as Property[];
  const rooms = (results[1].data ?? []) as Room[];
  const reservations = (results[2].data ?? []) as Reservation[];
  const guests = useMemo(() => reservations.map(toDashboardGuest), [reservations]);

  return {
    properties,
    rooms,
    reservations,
    guests,
    loading: results.some((result) => result.isPending),
  };
}

export function useGuestsPageData(): ReservationPageData {
  return useReservationsPageData();
}

export function useRoomsPageData(): RoomsPageData {
  const { properties, rooms, guests, loading } = useReservationsPageData();
  return { properties, rooms, guests, loading };
}

export function useMaintenancePageData(): MaintenancePageData {
  const repos = useMemo(() => createRestRepositories(), []);
  const results = useQueries({
    queries: [
      {
        queryKey: dashboardKeys.properties,
        queryFn: () => repos.properties.getAll(),
        staleTime: REFERENCE_STALE_TIME,
      },
      {
        queryKey: dashboardKeys.rooms,
        queryFn: () => repos.rooms.getAll(),
        staleTime: REFERENCE_STALE_TIME,
      },
      {
        queryKey: dashboardKeys.maintenance,
        queryFn: () => repos.maintenance.getAll(),
      },
    ],
  });

  return {
    properties: (results[0].data ?? []) as Property[],
    rooms: (results[1].data ?? []) as Room[],
    maintenance: (results[2].data ?? []) as MaintenanceIssue[],
    loading: results.some((result) => result.isPending),
  };
}
