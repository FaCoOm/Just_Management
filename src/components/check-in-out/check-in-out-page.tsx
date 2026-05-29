import { useMemo, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useReservationsPageData } from "@/hooks/use-page-data";
import { formatVietnamDate } from "@/lib/vietnam-time";
import {
  LogIn,
  LogOut,
  Clock,
  UserCheck,
  BedDouble,
  AlertCircle,
} from "lucide-react";
import type { Guest, Property, Room } from "@/types/database";

function CheckInOutSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </div>
  );
}

function GuestCard({ guest, rooms, properties, type }: {
  guest: Guest;
  rooms: Room[];
  properties: Property[];
  type: "arrival" | "departure";
}) {
  const room = rooms.find((r) => r.id === guest.room_id);
  const property = properties.find((p) => p.id === guest.property_id);
  const initials = guest.guest_name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <div
      className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40"
      data-testid={`guest-card-${guest.id}`}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className={`text-xs ${guest.is_vip ? "bg-chart-4/20 text-chart-4" : "bg-secondary"}`}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">{guest.guest_name}</p>
            {guest.is_vip && (
              <Badge variant="outline" className="text-[9px] bg-chart-4/10 text-chart-4 border-chart-4/20">
                VIP
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {room ? (
              <span className="flex items-center gap-1">
                <BedDouble className="h-3 w-3" />
                {room.room_number} · {room.room_type}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3 w-3" />
                No room assigned
              </span>
            )}
            <span>·</span>
            <span>{property?.name}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {type === "arrival" ? "Check-in" : "Check-out"}:{" "}
            {type === "arrival" ? formatVietnamDate(guest.eta ?? "") : formatVietnamDate(guest.etd ?? "")}
            {" · "}{guest.guest_count} {guest.guest_count === 1 ? "guest" : "guests"}
          </p>
        </div>
      </div>
      <div>
        {type === "arrival" ? (
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs bg-harbor text-harbor-foreground hover:bg-harbor-deep"
            data-testid={`check-in-btn-${guest.id}`}
          >
            <LogIn className="h-3.5 w-3.5" />
            Check In
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            data-testid={`check-out-btn-${guest.id}`}
          >
            <LogOut className="h-3.5 w-3.5" />
            Check Out
          </Button>
        )}
      </div>
    </div>
  );
}

export function CheckInOutPage() {
  const { guests, rooms, properties, loading } = useReservationsPageData();
  const [propertyFilter, setPropertyFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (propertyFilter === "all") return guests;
    return guests.filter((g) => g.property_id === propertyFilter);
  }, [guests, propertyFilter]);

  const arrivals = useMemo(
    () => filtered.filter((g) => ["Pending", "Check-In Pending"].includes(g.check_in_status)),
    [filtered]
  );
  const departures = useMemo(
    () => filtered.filter((g) => g.check_in_status === "Check-Out Pending"),
    [filtered]
  );
  const inHouse = useMemo(
    () => filtered.filter((g) => g.check_in_status === "Checked In"),
    [filtered]
  );
  const completed = useMemo(
    () => filtered.filter((g) => g.check_in_status === "Checked Out"),
    [filtered]
  );

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <CheckInOutHeader propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter} properties={[]} />
        <CheckInOutSkeleton />
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-svh flex-col" data-testid="check-in-out-page">
      <CheckInOutHeader propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter} properties={properties} />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Arrivals Today</CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1">
                  <LogIn className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight" data-testid="arrivals-count">{arrivals.length}</span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Departures Today</CardTitle>
                <div className="rounded-md bg-harbor-deep/10 p-1.5 text-harbor-deep">
                  <LogOut className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight" data-testid="departures-count">{departures.length}</span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">In-House</CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <UserCheck className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight" data-testid="in-house-count">{inHouse.length}</span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Completed</CardTitle>
                <div className="rounded-md bg-muted p-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight" data-testid="completed-count">{completed.length}</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1">
                    <LogIn className="h-3.5 w-3.5" />
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    Arrivals ({arrivals.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {arrivals.length === 0 ? (
                  <div className="py-8 text-center">
                    <LogIn className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No arrivals pending</p>
                  </div>
                ) : (
                  arrivals.map((guest) => (
                    <GuestCard key={guest.id} guest={guest} rooms={rooms} properties={properties} type="arrival" />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-harbor-deep/10 p-1.5 text-harbor-deep">
                    <LogOut className="h-3.5 w-3.5" />
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    Departures ({departures.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {departures.length === 0 ? (
                  <div className="py-8 text-center">
                    <LogOut className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No departures pending</p>
                  </div>
                ) : (
                  departures.map((guest) => (
                    <GuestCard key={guest.id} guest={guest} rooms={rooms} properties={properties} type="departure" />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckInOutHeader({ propertyFilter, setPropertyFilter, properties }: {
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
          <h2 className="text-sm font-semibold">Check-in / Check-out</h2>
          <p className="text-xs text-muted-foreground">Today's arrivals and departures board</p>
        </div>
      </div>
      <Select value={propertyFilter} onValueChange={setPropertyFilter}>
        <SelectTrigger className="h-8 w-44 text-xs" data-testid="property-filter">
          <SelectValue placeholder="All Properties" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Properties</SelectItem>
          {properties.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </header>
  );
}
