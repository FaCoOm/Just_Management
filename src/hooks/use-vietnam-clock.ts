import { useEffect, useMemo, useState } from "react";
import { getVietnamToday } from "@/lib/vietnam-time";

export function useVietnamClock(refreshMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, refreshMs);

    return () => window.clearInterval(timer);
  }, [refreshMs]);

  return useMemo(
    () => ({
      now: new Date(now),
      today: getVietnamToday(now),
    }),
    [now]
  );
}
