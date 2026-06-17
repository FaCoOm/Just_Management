import { useState } from "react";

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
import { RoomCalendarPanel } from "./room-calendar-panel";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useVietnamClock } from "@/hooks/use-vietnam-clock";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardLayoutMode = "dashboard" | "split";

function LayoutModeToggle({ mode, onChange }: { readonly mode: DashboardLayoutMode; readonly onChange: (mode: DashboardLayoutMode) => void }) {
  return (
    <div className="flex items-center justify-end gap-1 px-4 pt-4">
      {(["dashboard", "split"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={mode === value}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            mode === value
              ? "border-harbor bg-harbor text-harbor-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-secondary"
          }`}
        >
          {value === "dashboard" ? "Dashboard" : "Split"}
        </button>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.2fr)_minmax(300px,0.9fr)]">
      <div className="min-h-0 space-y-4 overflow-hidden">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
        <div className="grid gap-3">
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
      </div>
      <Skeleton className="min-h-[520px] rounded-lg" />
      <Skeleton className="min-h-[520px] rounded-lg" />
    </div>
  );
}

export function DashboardPage() {
  const [layoutMode, setLayoutMode] = useState<DashboardLayoutMode>("dashboard");
  const { today } = useVietnamClock();
  const {
    properties,
    rooms,
    reservations,
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

  const calendarPanel = (
    <RoomCalendarPanel
      properties={properties}
      rooms={rooms}
      reservations={reservations}
      today={today}
    />
  );

  const bookingsPanel = (
    <BookingsPanel
      guests={guests}
      rooms={rooms}
      properties={properties}
      today={today}
    />
  );

  const dashboardContent = (
    <div className="space-y-4">
      <KpiSummary totals={totals} />

      <OccupancyChart data={occupancySeries} today={today} />

      {calendarPanel}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
        <RevenueOverview />
        <RecentArrivals guests={guests} rooms={rooms} />
      </div>

      <BranchComparison metrics={metrics} />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
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
  );

  return (
    <div className="flex h-full max-h-svh flex-col">
      <DashboardHeader today={today} />
      <LayoutModeToggle mode={layoutMode} onChange={setLayoutMode} />

      {layoutMode === "dashboard" ? (
        <div className="grid flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_clamp(300px,26vw,380px)]">
          <div className="min-h-0 min-w-0 overflow-y-auto">
            {dashboardContent}
          </div>

          <div className="min-h-0 min-w-0 overflow-hidden">
            {bookingsPanel}
          </div>
        </div>
      ) : (
        <div className="grid flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.2fr)_minmax(300px,0.9fr)]">
          <div className="min-h-0 min-w-0 overflow-y-auto">
            <div className="space-y-4">
              <KpiSummary totals={totals} />
              <OccupancyChart data={occupancySeries} today={today} />
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
                <RevenueOverview />
                <RecentArrivals guests={guests} rooms={rooms} />
              </div>
              <BranchComparison metrics={metrics} />
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
                <ArrivalsDetail guests={todayArrivals} properties={properties} rooms={rooms} />
                <CheckoutsToday guests={todayCheckouts} properties={properties} rooms={rooms} />
              </div>
              <DeparturesDetail guests={todayDepartures} properties={properties} rooms={rooms} />
              <MaintenanceDetail maintenance={maintenance} properties={properties} />
            </div>
          </div>

          <div className="min-h-0 min-w-0 overflow-hidden">
            {calendarPanel}
          </div>

          <div className="min-h-0 min-w-0 overflow-hidden">
            {bookingsPanel}
          </div>
        </div>
      )}
    </div>
  );
}
