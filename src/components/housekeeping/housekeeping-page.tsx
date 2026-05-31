import { useMemo, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoomsPageData } from "@/hooks/use-page-data";
import { Sparkles, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import type { Property, Room } from "@/types/database";

type CleanlinessState = "dirty" | "cleaning" | "inspected" | "ready";

interface HousekeepingRoom {
  room: Room;
  cleanState: CleanlinessState;
  priority: "high" | "normal" | "low";
  checkoutToday: boolean;
  propertyName: string;
}

const cleanlinessConfig: Record<CleanlinessState, { label: string; icon: typeof Sparkles; className: string; badgeClass: string }> = {
  dirty: { label: "Dirty", icon: AlertTriangle, className: "text-destructive", badgeClass: "bg-destructive/10 text-destructive border-destructive/20" },
  cleaning: { label: "Cleaning", icon: Clock, className: "text-chart-4", badgeClass: "bg-chart-4/10 text-chart-4 border-chart-4/20" },
  inspected: { label: "Inspected", icon: CheckCircle2, className: "text-chart-1", badgeClass: "bg-chart-1/10 text-chart-1 border-chart-1/20" },
  ready: { label: "Ready", icon: Sparkles, className: "text-emerald-600 dark:text-emerald-400", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
};

function HousekeepingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-lg" />))}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

function deriveCleanState(room: Room): CleanlinessState {
  if (room.status === "Check-Out Pending" || room.status === "Checked Out") return "dirty";
  if (room.status === "Needs Attention") return "dirty";
  if (room.status === "Vacant") return "ready";
  if (room.status === "Check-In Pending") return "inspected";
  return "ready";
}

export function HousekeepingPage() {
  const { rooms, properties, guests, loading } = useRoomsPageData();
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");

  const housekeepingRooms = useMemo<HousekeepingRoom[]>(() => {
    return rooms
      .filter((r) => propertyFilter === "all" || r.property_id === propertyFilter)
      .map((room) => {
        const cleanState = deriveCleanState(room);
        const checkoutToday = room.status === "Check-Out Pending";
        const priority: "high" | "normal" | "low" = cleanState === "dirty" && checkoutToday ? "high" : cleanState === "dirty" ? "normal" : "low";
        const propertyName = properties.find((p) => p.id === room.property_id)?.name ?? "";
        return { room, cleanState, priority, checkoutToday, propertyName };
      })
      .filter((hr) => stateFilter === "all" || hr.cleanState === stateFilter)
      .sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }, [rooms, properties, propertyFilter, stateFilter]);

  const dirtyCount = housekeepingRooms.filter((hr) => hr.cleanState === "dirty").length;
  const cleaningCount = housekeepingRooms.filter((hr) => hr.cleanState === "cleaning").length;
  const inspectedCount = housekeepingRooms.filter((hr) => hr.cleanState === "inspected").length;
  const readyCount = housekeepingRooms.filter((hr) => hr.cleanState === "ready").length;

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <HousekeepingHeader propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter} stateFilter={stateFilter} setStateFilter={setStateFilter} properties={[]} />
        <HousekeepingSkeleton />
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-svh flex-col" data-testid="housekeeping-page">
      <HousekeepingHeader propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter} stateFilter={stateFilter} setStateFilter={setStateFilter} properties={properties} />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Dirty</CardTitle>
                <div className="rounded-md bg-destructive/10 p-1.5 text-destructive"><AlertTriangle className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="dirty-count">{dirtyCount}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Cleaning</CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4"><Clock className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="cleaning-count">{cleaningCount}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Inspected</CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1"><CheckCircle2 className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="inspected-count">{inspectedCount}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Ready</CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"><Sparkles className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="ready-count">{readyCount}</span></CardContent>
            </Card>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {housekeepingRooms.map((hr) => {
              const config = cleanlinessConfig[hr.cleanState];
              const Icon = config.icon;
              const currentGuest = guests.find((g) => g.room_id === hr.room.id && g.check_in_status !== "Checked Out");
              return (
                <Card key={hr.room.id} className="transition-shadow hover:shadow-sm" data-testid={`hk-room-${hr.room.room_number}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{hr.room.room_number}</span>
                          {hr.checkoutToday && (
                            <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                              Checkout Today
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{hr.room.room_type}</p>
                        {propertyFilter === "all" && (
                          <p className="text-[10px] text-muted-foreground">{hr.propertyName}</p>
                        )}
                      </div>
                      <Icon className={`h-4 w-4 ${config.className}`} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge variant="outline" className={`text-[10px] ${config.badgeClass}`}>
                        {config.label}
                      </Badge>
                      {currentGuest && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-20">
                          {currentGuest.guest_name}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {housekeepingRooms.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">All rooms are clean and ready</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function HousekeepingHeader({ propertyFilter, setPropertyFilter, stateFilter, setStateFilter, properties }: {
  propertyFilter: string;
  setPropertyFilter: (v: string) => void;
  stateFilter: string;
  setStateFilter: (v: string) => void;
  properties: Property[];
}) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Housekeeping</h2>
          <p className="text-xs text-muted-foreground">Room cleanliness and turnover board</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="h-8 w-32 text-xs" data-testid="state-filter">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="dirty">Dirty</SelectItem>
            <SelectItem value="cleaning">Cleaning</SelectItem>
            <SelectItem value="inspected">Inspected</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
          </SelectContent>
        </Select>
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="h-8 w-44 text-xs" data-testid="property-filter">
            <SelectValue placeholder="All Properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}
