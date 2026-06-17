import { DashboardHeader } from "./header";
import { KpiSummary } from "./kpi-summary";
import { OccupancyChart } from "./occupancy-chart";
import { RevenueOverview } from "./revenue-overview";
import { RecentArrivals } from "./recent-arrivals";
import { BranchComparison } from "./branch-comparison";
import { ArrivalsDetail } from "./arrivals-detail";
import { DeparturesDetail } from "./departures-detail";
import { CheckoutsToday } from "./checkouts-today";
import { MaintenanceDetail } from "./maintenance-detail";
import { BookingsPanel } from "./bookings-panel";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useVietnamClock } from "@/hooks/use-vietnam-clock";
import { Skeleton } from "@/components/ui/skeleton";

function DashboardSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { today } = useVietnamClock();
  const {
    properties,
    rooms,
    guests,
    maintenance,
    metrics,
    totals,
    todayArrivals,
    todayDepartures,
    todayCheckouts,
    occupancySeries,
    loading,
  } = useDashboardData(today);

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader today={today} />
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-svh flex-col">
      <DashboardHeader today={today} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-4">
            <KpiSummary totals={totals} />

            <OccupancyChart data={occupancySeries} today={today} />

            <div className="grid gap-4 md:grid-cols-2">
              <RevenueOverview />
              <RecentArrivals guests={guests} rooms={rooms} />
            </div>

            <BranchComparison metrics={metrics} />

            <div className="grid gap-4 md:grid-cols-2">
              <ArrivalsDetail
                guests={todayArrivals}
                properties={properties}
                rooms={rooms}
              />
              <CheckoutsToday
                guests={todayCheckouts}
                properties={properties}
                rooms={rooms}
              />
            </div>
            <div className="grid gap-4">
              <DeparturesDetail
                guests={todayDepartures}
                properties={properties}
                rooms={rooms}
              />
            </div>

            <div className="grid gap-4">
              <MaintenanceDetail
                maintenance={maintenance}
                properties={properties}
              />
            </div>
          </div>
        </div>

        <div className="hidden w-[340px] shrink-0 overflow-y-auto xl:block">
          <BookingsPanel
            guests={guests}
            rooms={rooms}
            properties={properties}
            today={today}
          />
        </div>
      </div>
    </div>
  );
}
