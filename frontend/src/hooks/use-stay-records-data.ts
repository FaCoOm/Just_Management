import { useMemo } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { createRestRepositories } from "@/lib/repositories";
import { dashboardKeys } from "@/lib/query-keys";
import type { Reservation, StayExperience, StayExperienceCreateInput, StayExperienceUpdateInput } from "@/types/database";

export interface StayRecordsData {
  shortTerm: StayExperience[];
  longTerm: StayExperience[];
  reservations: Reservation[];
  loading: boolean;
}

function groupByStayType(stays: StayExperience[]) {
  return {
    shortTerm: stays.filter((stay) => stay.stay_type === "short_term"),
    longTerm: stays.filter((stay) => stay.stay_type === "long_term"),
  };
}

export function useStayRecordsData(propertyId: string): StayRecordsData {
  const repos = useMemo(() => createRestRepositories(), []);
  const results = useQueries({
    queries: [
      {
        queryKey: dashboardKeys.stayExperiencesByProperty(propertyId),
        queryFn: () => repos.stayExperiences.getAll(propertyId),
      },
      {
        queryKey: dashboardKeys.reservations,
        queryFn: () => repos.reservations.getByPropertyId(propertyId),
      },
    ],
  });
  const stays = (results[0].data ?? []) as StayExperience[];
  const grouped = useMemo(() => groupByStayType(stays), [stays]);

  return {
    ...grouped,
    reservations: (results[1].data ?? []) as Reservation[],
    loading: results.some((result) => result.isPending),
  };
}

export function useStayExperienceMutations() {
  const repos = useMemo(() => createRestRepositories(), []);
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.stayExperiences });
  };

  return {
    create: useMutation({
      mutationFn: (input: StayExperienceCreateInput) => repos.stayExperiences.create(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: StayExperienceUpdateInput }) =>
        repos.stayExperiences.update(id, input),
      onSuccess: invalidate,
    }),
    delete: useMutation({
      mutationFn: (id: string) => repos.stayExperiences.delete(id),
      onSuccess: invalidate,
    }),
  };
}
