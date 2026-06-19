import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRestRepositories } from "@/lib/repositories";
import { dashboardKeys } from "@/lib/query-keys";
import { useVietnamClock } from "@/hooks/use-vietnam-clock";

export function useCheckInOut() {
  const repos = useMemo(() => createRestRepositories(), []);
  const queryClient = useQueryClient();
  const { today } = useVietnamClock();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.reservations });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.rooms });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.folios });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.summary(today) });
  };

  return {
    checkIn: useMutation({
      mutationFn: (reservationId: string) => repos.checkInOut.checkIn(reservationId),
      onSuccess: invalidate,
    }),
    checkOut: useMutation({
      mutationFn: (reservationId: string) => repos.checkInOut.checkOut(reservationId),
      onSuccess: invalidate,
    }),
  };
}
