import { useMemo, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReservationsPageData } from "@/hooks/use-page-data";
import { ChevronLeft, ChevronRight, CalendarDays, BedDouble, Layers } from "lucide-react";
import type { Property, Room, Reservation } from "@/types/database";

function AvailabilitySkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { day: days[d.getUTCDay()], date: d.getUTCDate(), month: months[d.getUTCMonth()] };
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function AvailabilityPage() {
  const { rooms, properties, reservations, loading } = useReservationsPageData();
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState(getToday());
  const daysToShow = 14;

  const dates = useMemo(() => {
    return Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));
  }, [startDate]);

  const filteredRooms = useMemo(() => {
    if (propertyFilter === "all") return rooms;
    return rooms.filter((r) => r.property_id === propertyFilter);
  }, [rooms, propertyFilter]);

  const roomAvailability = useMemo(() => {
    return filteredRooms.map((room) => {
      const roomReservations = reservations.filter(
        (res) => res.primary_room_id === room.id
      );
      const dateMap = new Map<string, { status: "occupied" | "arriving" | "departing" | "vacant"; guestName?: string }>();
      for (const date of dates) {
        let status: "occupied" | "arriving" | "departing" | "vacant" = "vacant";
        let guestName: string | undefined;
        for (const res of roomReservations) {
          const cin = res.check_in_date.slice(0, 10);
          const cout = res.check_out_date.slice(0, 10);
          if (date >= cin && date < cout) {
            if (date === cin) status = "arriving";
            else if (date === addDays(cout, -1)) status = "departing";
            else status = "occupied";
            guestName = res.guest_name;
            break;
          }
        }
        dateMap.set(date, { status, guestName });
      }
      return { room, dateMap };
    });
  }, [filteredRooms, reservations, dates]);

  const todayStr = getToday();
  const todayOccupied = roomAvailability.filter((ra) => {
    const info = ra.dateMap.get(todayStr);
    return info && info.status !== "vacant";
  }).length;
  const todayVacant = filteredRooms.length - todayOccupied;
  const occupancyRate = filteredRooms.length > 0 ? Math.round((todayOccupied / filteredRooms.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <AvailabilityHeader
          propertyFilter={propertyFilter}
          setPropertyFilter={setPropertyFilter}
          properties={[]}
          onPrev={() => {}}
          onNext={() => {}}
          onToday={() => {}}
          startDate={startDate}
        />
        <AvailabilitySkeleton />
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-svh flex-col" data-testid="availability-page">
      <AvailabilityHeader
        propertyFilter={propertyFilter}
        setPropertyFilter={setPropertyFilter}
        properties={properties}
        onPrev={() => setStartDate(addDays(startDate, -7))}
        onNext={() => setStartDate(addDays(startDate, 7))}
        onToday={() => setStartDate(getToday())}
        startDate={startDate}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Rooms</CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1"><BedDouble className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="total-rooms">{filteredRooms.length}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Occupied Today</CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4"><BedDouble className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="occupied-today">{todayOccupied}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Vacant Today</CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"><BedDouble className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="vacant-today">{todayVacant}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Occupancy Rate</CardTitle>
                <div className="rounded-md bg-harbor/10 p-1.5 text-harbor"><Layers className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="occupancy-rate">{occupancyRate}%</span></CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-xs" data-testid="availability-grid">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="sticky left-0 z-10 bg-card px-3 py-2.5 text-left font-semibold w-32">Room</th>
                      {dates.map((date) => {
                        const info = formatShortDate(date);
                        const isToday = date === todayStr;
                        return (
                          <th key={date} className={`px-1 py-2 text-center font-medium min-w-[52px] ${isToday ? "bg-harbor/5" : ""}`}>
                            <div className="text-[10px] text-muted-foreground">{info.day}</div>
                            <div className={`text-xs ${isToday ? "text-harbor font-bold" : ""}`}>{info.date}</div>
                            <div className="text-[10px] text-muted-foreground">{info.month}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {roomAvailability.map(({ room, dateMap }) => {
                      const property = properties.find((p) => p.id === room.property_id);
                      return (
                        <tr key={room.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="sticky left-0 z-10 bg-card px-3 py-2">
                            <span className="font-semibold">{room.room_number}</span>
                            <span className="ml-1 text-muted-foreground text-[10px]">{room.room_type}</span>
                            {propertyFilter === "all" && (
                              <div className="text-[9px] text-muted-foreground truncate max-w-24">{property?.name}</div>
                            )}
                          </td>
                          {dates.map((date) => {
                            const info = dateMap.get(date);
                            const isToday = date === todayStr;
                            const cellBg = !info || info.status === "vacant"
                              ? isToday ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""
                              : info.status === "arriving"
                              ? "bg-chart-1/15"
                              : info.status === "departing"
                              ? "bg-amber-100/50 dark:bg-amber-950/30"
                              : "bg-chart-1/10";
                            return (
                              <td
                                key={date}
                                className={`px-1 py-2 text-center ${cellBg} ${isToday ? "ring-1 ring-inset ring-harbor/20" : ""}`}
                                title={info?.guestName ? `${info.guestName} (${info.status})` : "Vacant"}
                              >
                                {info && info.status !== "vacant" ? (
                                  <div className={`mx-auto h-5 w-5 rounded-sm flex items-center justify-center text-[9px] font-medium ${
                                    info.status === "arriving" ? "bg-chart-1/20 text-chart-1" :
                                    info.status === "departing" ? "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300" :
                                    "bg-chart-1/15 text-chart-1"
                                  }`}>
                                    {info.guestName?.[0] ?? "·"}
                                  </div>
                                ) : null}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm bg-chart-1/20" /> Arriving</div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm bg-chart-1/10" /> Occupied</div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm bg-amber-200 dark:bg-amber-900" /> Departing</div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm bg-background border border-border" /> Vacant</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AvailabilityHeader({ propertyFilter, setPropertyFilter, properties, onPrev, onNext, onToday, startDate }: {
  propertyFilter: string;
  setPropertyFilter: (v: string) => void;
  properties: Property[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  startDate: string;
}) {
  const endDate = addDays(startDate, 13);
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Availability</h2>
          <p className="text-xs text-muted-foreground">{startDate} – {endDate}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onPrev} data-testid="prev-week"><ChevronLeft className="h-3.5 w-3.5" /></Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onToday} data-testid="today-btn"><CalendarDays className="h-3.5 w-3.5 mr-1" /> Today</Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onNext} data-testid="next-week"><ChevronRight className="h-3.5 w-3.5" /></Button>
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
