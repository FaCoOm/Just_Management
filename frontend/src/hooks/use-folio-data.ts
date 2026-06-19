import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRestRepositories } from "@/lib/repositories";
import { dashboardKeys } from "@/lib/query-keys";
import type { FolioLineItemInput, FolioPaymentInput } from "@/types/database";

export function useFolioData(reservationId: string | null | undefined) {
  const repos = useMemo(() => createRestRepositories(), []);

  return useQuery({
    queryKey: dashboardKeys.foliosByReservation(reservationId ?? "none"),
    queryFn: () => repos.folios.getByReservationId(reservationId ?? ""),
    enabled: Boolean(reservationId),
  });
}

export function useFolioMutations(folioId: string | null | undefined) {
  const repos = useMemo(() => createRestRepositories(), []);
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.folios });
    if (folioId) void queryClient.invalidateQueries({ queryKey: dashboardKeys.folioById(folioId) });
  };

  return {
    postLineItem: useMutation({
      mutationFn: (input: FolioLineItemInput) => repos.folios.addLineItem(folioId ?? "", input),
      onSuccess: invalidate,
    }),
    recordPayment: useMutation({
      mutationFn: (input: FolioPaymentInput) => repos.folios.recordPayment(folioId ?? "", input),
      onSuccess: invalidate,
    }),
  };
}
