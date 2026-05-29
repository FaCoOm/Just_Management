import { useMemo, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useReservationsPageData } from "@/hooks/use-page-data";
import {
  UtensilsCrossed,
  CalendarDays,
  Clock,
  Plus,
  Users,
  MapPin,
} from "lucide-react";
import type { Property } from "@/types/database";

interface EventBooking {
  id: string;
  title: string;
  type: "dinner" | "event" | "meeting" | "celebration";
  venue: string;
  date: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  guestName: string;
  propertyId: string;
  status: "confirmed" | "pending" | "cancelled";
  notes: string;
}

const eventTypeConfig: Record<string, { label: string; className: string }> = {
  dinner: { label: "Private Dining", className: "bg-chart-4/10 text-chart-4 border-chart-4/20" },
  event: { label: "Event", className: "bg-chart-1/10 text-chart-1 border-chart-1/20" },
  meeting: { label: "Meeting", className: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
  celebration: { label: "Celebration", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
};

function DiningEventsSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-lg" />))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

function generateMockEvents(properties: Property[]): EventBooking[] {
  const today = new Date().toISOString().slice(0, 10);
  const events: EventBooking[] = [];
  const venues = ["Rooftop Terrace", "Garden Pavilion", "Private Dining Room", "Pool Deck", "Conference Room A"];
  const types: EventBooking["type"][] = ["dinner", "event", "meeting", "celebration"];
  const names = ["Nguyen Wedding Party", "Corporate Retreat Dinner", "Birthday Celebration", "Wine Tasting Event", "Team Building Lunch", "Anniversary Dinner"];

  let idx = 0;
  for (const prop of properties.slice(0, 4)) {
    for (let i = 0; i < 3; i++) {
      events.push({
        id: `evt-${idx}`,
        title: names[idx % names.length],
        type: types[idx % types.length],
        venue: venues[idx % venues.length],
        date: today,
        startTime: `${17 + i}:00`,
        endTime: `${19 + i}:00`,
        guestCount: 6 + (idx * 4),
        guestName: names[idx % names.length].split(" ")[0],
        propertyId: prop.id,
        status: i === 2 ? "pending" : "confirmed",
        notes: i === 0 ? "Vegetarian options required" : "",
      });
      idx++;
    }
  }
  return events;
}

export function DiningEventsPage() {
  const { properties, loading } = useReservationsPageData();
  const [propertyFilter, setPropertyFilter] = useState<string>("all");

  const events = useMemo(() => generateMockEvents(properties), [properties]);
  const filtered = useMemo(() => {
    if (propertyFilter === "all") return events;
    return events.filter((e) => e.propertyId === propertyFilter);
  }, [events, propertyFilter]);

  const confirmedCount = filtered.filter((e) => e.status === "confirmed").length;
  const pendingCount = filtered.filter((e) => e.status === "pending").length;
  const totalGuests = filtered.reduce((sum, e) => sum + e.guestCount, 0);

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <DiningEventsHeader propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter} properties={[]} />
        <DiningEventsSkeleton />
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-svh flex-col" data-testid="dining-events-page">
      <DiningEventsHeader propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter} properties={properties} />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Today's Events</CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1"><CalendarDays className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="events-count">{filtered.length}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Confirmed</CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"><UtensilsCrossed className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="confirmed-count">{confirmedCount}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Pending</CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4"><Clock className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="pending-count">{pendingCount}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Guests</CardTitle>
                <div className="rounded-md bg-harbor/10 p-1.5 text-harbor"><Users className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="guests-count">{totalGuests}</span></CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            {filtered.map((event) => {
              const typeConfig = eventTypeConfig[event.type] ?? eventTypeConfig.event;
              const property = properties.find((p) => p.id === event.propertyId);
              return (
                <Card key={event.id} className="transition-shadow hover:shadow-sm" data-testid={`event-card-${event.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">{event.title}</h3>
                          <Badge variant="outline" className={`text-[10px] ${typeConfig.className}`}>{typeConfig.label}</Badge>
                          <Badge variant="outline" className={`text-[10px] ${event.status === "confirmed" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" : "bg-chart-4/10 text-chart-4 border-chart-4/20"}`}>
                            {event.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{event.startTime} – {event.endTime}</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.venue}</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{event.guestCount} guests</span>
                          {property && <span>{property.name}</span>}
                        </div>
                        {event.notes && <p className="text-xs text-muted-foreground italic">{event.notes}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <UtensilsCrossed className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No events scheduled for today</p>
                <p className="text-xs text-muted-foreground mt-1">Create a new event to get started</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DiningEventsHeader({ propertyFilter, setPropertyFilter, properties }: {
  propertyFilter: string;
  setPropertyFilter: (v: string) => void;
  properties: Property[];
}) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Dining & Events</h2>
          <p className="text-xs text-muted-foreground">Venue bookings and event schedule</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="h-8 w-44 text-xs" data-testid="property-filter">
            <SelectValue placeholder="All Properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-8 gap-1.5 text-xs bg-harbor text-harbor-foreground hover:bg-harbor-deep" data-testid="new-event-btn">
          <Plus className="h-3.5 w-3.5" />
          New Event
        </Button>
      </div>
    </header>
  );
}
