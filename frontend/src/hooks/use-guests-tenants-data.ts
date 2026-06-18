import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRestRepositories } from "@/lib/repositories";
import { dashboardKeys } from "@/lib/query-keys";
import type {
  GuestRequestCreateInput,
  StayRegistrationCreateInput,
  TenantCreateInput,
} from "@/lib/repositories";
import type {
  GuestRequest,
  GuestRequestPriority,
  GuestRequestStatus,
  StayRegistration,
  Tenant,
  TenantStatus,
} from "@/types/database";

interface TenantFilters {
  status?: TenantStatus;
}

interface StayRegistrationFilters {
  tenant_id?: string | null;
  room_id?: string | null;
}

interface GuestRequestFilters {
  status?: GuestRequestStatus;
  priority?: GuestRequestPriority;
  assigned_to?: string | null;
}

function toFilterKey(value?: string | null) {
  if (value === undefined) return "all";
  return value ?? "none";
}

function filterGuestRequests(requests: GuestRequest[], filters?: GuestRequestFilters) {
  if (!filters) return requests;

  return requests.filter((request) => {
    if (filters.status !== undefined && request.status !== filters.status) return false;
    if (filters.priority !== undefined && request.priority !== filters.priority) return false;
    if (filters.assigned_to !== undefined && request.assigned_to !== filters.assigned_to) return false;
    return true;
  });
}

export function useTenants(propertyId: string, filters?: TenantFilters) {
  const repos = useMemo(() => createRestRepositories(), []);

  return useQuery<Tenant[]>({
    queryKey: dashboardKeys.tenantsByProperty(propertyId, filters?.status ?? "all"),
    queryFn: () => repos.tenantRepository.getAll(propertyId, filters),
  });
}

export function useStayRegistrations(propertyId: string, filters?: StayRegistrationFilters) {
  const repos = useMemo(() => createRestRepositories(), []);

  return useQuery<StayRegistration[]>({
    queryKey: dashboardKeys.stayRegistrationsByProperty(
      propertyId,
      toFilterKey(filters?.tenant_id),
      toFilterKey(filters?.room_id)
    ),
    queryFn: () => repos.stayRegistrationRepository.getAll(propertyId, filters),
  });
}

export function useGuestRequests(propertyId: string, filters?: GuestRequestFilters) {
  const repos = useMemo(() => createRestRepositories(), []);

  return useQuery<GuestRequest[]>({
    queryKey: dashboardKeys.guestRequestsByProperty(
      propertyId,
      filters?.status ?? "all",
      filters?.priority ?? "all",
      toFilterKey(filters?.assigned_to)
    ),
    queryFn: async () => {
      const requests = await repos.guestRequests.getByPropertyId(propertyId);
      return filterGuestRequests(requests, filters);
    },
  });
}

export function useCreateTenant() {
  const repos = useMemo(() => createRestRepositories(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TenantCreateInput) => repos.tenantRepository.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.tenants });
    },
  });
}

export function useCreateStayRegistration() {
  const repos = useMemo(() => createRestRepositories(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: StayRegistrationCreateInput) => repos.stayRegistrationRepository.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.stayRegistrations });
    },
  });
}

export function useCreateGuestRequest() {
  const repos = useMemo(() => createRestRepositories(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GuestRequestCreateInput) => repos.guestRequests.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.guestRequests });
    },
  });
}

export function useTransitionGuestRequest() {
  const repos = useMemo(() => createRestRepositories(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
      assigned_to,
    }: {
      id: string;
      status: GuestRequestStatus;
      assigned_to?: string | null;
    }) => repos.guestRequests.transitionStatus(id, status, assigned_to),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.guestRequests });
    },
  });
}
