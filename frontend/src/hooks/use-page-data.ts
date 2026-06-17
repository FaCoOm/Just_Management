import { useMemo } from "react";
import { useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import { createRestRepositories } from "@/lib/repositories";
import { dashboardKeys } from "@/lib/query-keys";
import { toDashboardGuest } from "@/hooks/use-dashboard-data";
import { useVietnamClock } from "@/hooks/use-vietnam-clock";
import type { Guest, MaintenanceIssue, Property, Reservation, Room, RoomStatus } from "@/types/database";
import type { DiningEventBooking, RoomRate, SecurityAuditEntry, StaffMember } from "@/lib/repositories";

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
  reservations: Reservation[];
  guests: Guest[];
  loading: boolean;
}

interface MaintenancePageData {
  properties: Property[];
  rooms: Room[];
  maintenance: MaintenanceIssue[];
  loading: boolean;
}

interface DiningEventsPageData {
  properties: Property[];
  events: DiningEventBooking[];
  loading: boolean;
}

interface StaffPageData {
  properties: Property[];
  staff: StaffMember[];
  loading: boolean;
}

interface SecurityAuditPageData {
  entries: SecurityAuditEntry[];
  loading: boolean;
}

interface RatesPageData extends Omit<RoomsPageData, "reservations"> {
  rates: RoomRate[];
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
  const { properties, rooms, reservations, guests, loading } = useReservationsPageData();
  return { properties, rooms, reservations, guests, loading };
}

export function useUpdateRoomStatus() {
  const repos = useMemo(() => createRestRepositories(), []);
  const queryClient = useQueryClient();
  const { today } = useVietnamClock();

  return useMutation({
    mutationFn: ({ roomId, status }: { roomId: string; status: RoomStatus }) =>
      repos.rooms.updateStatus(roomId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.rooms });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.reservations });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.summary(today) });
    },
  });
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

export function useDiningEventsPageData(): DiningEventsPageData {
  const repos = useMemo(() => createRestRepositories(), []);
  const results = useQueries({
    queries: [
      {
        queryKey: dashboardKeys.properties,
        queryFn: () => repos.properties.getAll(),
        staleTime: REFERENCE_STALE_TIME,
      },
      {
        queryKey: dashboardKeys.diningEvents,
        queryFn: () => repos.diningEvents.getAll(),
      },
    ],
  });

  return {
    properties: (results[0].data ?? []) as Property[],
    events: (results[1].data ?? []) as DiningEventBooking[],
    loading: results.some((result) => result.isPending),
  };
}

export function useStaffPageData(): StaffPageData {
  const repos = useMemo(() => createRestRepositories(), []);
  const results = useQueries({
    queries: [
      {
        queryKey: dashboardKeys.properties,
        queryFn: () => repos.properties.getAll(),
        staleTime: REFERENCE_STALE_TIME,
      },
      {
        queryKey: dashboardKeys.staff,
        queryFn: () => repos.staff.getAll(),
      },
    ],
  });

  return {
    properties: (results[0].data ?? []) as Property[],
    staff: (results[1].data ?? []) as StaffMember[],
    loading: results.some((result) => result.isPending),
  };
}

export function useSecurityAuditPageData(): SecurityAuditPageData {
  const repos = useMemo(() => createRestRepositories(), []);
  const results = useQueries({
    queries: [
      {
        queryKey: dashboardKeys.securityAudit,
        queryFn: () => repos.securityAudit.getAll(),
      },
    ],
  });

  return {
    entries: (results[0].data ?? []) as SecurityAuditEntry[],
    loading: results.some((result) => result.isPending),
  };
}

export function useRatesPageData(startDate: string, endDate: string, propertyId?: string): RatesPageData {
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
        queryKey: dashboardKeys.rates(startDate, endDate, propertyId ?? "all"),
        queryFn: () => repos.rates.getByDateRange(startDate, endDate, propertyId),
      },
    ],
  });

  return {
    properties: (results[0].data ?? []) as Property[],
    rooms: (results[1].data ?? []) as Room[],
    guests: [],
    rates: (results[2].data ?? []) as RoomRate[],
    loading: results.some((result) => result.isPending),
  };
}
