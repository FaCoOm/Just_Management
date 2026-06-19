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
import { useCheckInOut } from "@/hooks/use-check-in-out";
import { useFolioData } from "@/hooks/use-folio-data";
import { formatVietnamDate } from "@/lib/vietnam-time";
import {
  LogIn,
  LogOut,
  Clock,
  UserCheck,
  BedDouble,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Guest, Property, Room } from "@/types/database";

const BOARD_PAGE_SIZE = 10;

interface PagedGuests {
  guests: Guest[];
  pageIndex: number;
  pageCount: number;
  start: number;
  end: number;
}

function getPagedGuests(guests: Guest[], pageIndex: number): PagedGuests {
  const pageCount = Math.max(Math.ceil(guests.length / BOARD_PAGE_SIZE), 1);
  const currentPageIndex = Math.min(pageIndex, pageCount - 1);
  const start = currentPageIndex * BOARD_PAGE_SIZE;

  return {
    guests: guests.slice(start, start + BOARD_PAGE_SIZE),
    pageIndex: currentPageIndex,
    pageCount,
    start,
    end: Math.min(start + BOARD_PAGE_SIZE, guests.length),
  };
}

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

function GuestCard({ guest, room, property, type }: {
  guest: Guest;
  room: Room | undefined;
  property: Property | undefined;
  type: "arrival" | "departure";
}) {
  const checkInOut = useCheckInOut();
  const folio = useFolioData(guest.reservation_id);
  const initials = guest.guest_name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const activeMutation = type === "arrival" ? checkInOut.checkIn : checkInOut.checkOut;

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
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Folio: {folio.data ? `${folio.data.status} · ${folio.data.balance_amount.toLocaleString("vi-VN")} VND` : "not opened"}
          </p>
        </div>
      </div>
      <div>
        {type === "arrival" ? (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs bg-harbor text-harbor-foreground hover:bg-harbor-deep"
              data-testid={`check-in-btn-${guest.id}`}
              disabled={activeMutation.isPending}
              onClick={() => activeMutation.mutate(guest.reservation_id)}
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
              disabled={activeMutation.isPending}
              onClick={() => activeMutation.mutate(guest.reservation_id)}
            >
            <LogOut className="h-3.5 w-3.5" />
            Check Out
          </Button>
        )}
      </div>
    </div>
  );
}

function GuestListPagination({ page, total, onPageChange }: {
  page: PagedGuests;
  total: number;
  onPageChange: (pageIndex: number) => void;
}) {
  if (total <= BOARD_PAGE_SIZE) return null;

  return (
    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing {page.start + 1}-{page.end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          disabled={page.pageIndex === 0}
          onClick={() => onPageChange(page.pageIndex - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page.pageIndex + 1} of {page.pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          disabled={page.pageIndex >= page.pageCount - 1}
          onClick={() => onPageChange(page.pageIndex + 1)}
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function CheckInOutPage() {
  const { guests, rooms, properties, loading } = useReservationsPageData();
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [arrivalPageIndex, setArrivalPageIndex] = useState(0);
  const [departurePageIndex, setDeparturePageIndex] = useState(0);

  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room] as const)), [rooms]);
  const propertyById = useMemo(
    () => new Map(properties.map((property) => [property.id, property] as const)),
    [properties]
  );

  const board = useMemo(() => {
    const next = {
      arrivals: [] as Guest[],
      departures: [] as Guest[],
      inHouseCount: 0,
      completedCount: 0,
    };

    for (const guest of guests) {
      if (propertyFilter !== "all" && guest.property_id !== propertyFilter) continue;

      if (["Pending", "Check-In Pending"].includes(guest.check_in_status)) {
        next.arrivals.push(guest);
      } else if (guest.check_in_status === "Check-Out Pending") {
        next.departures.push(guest);
      } else if (guest.check_in_status === "Checked In") {
        next.inHouseCount += 1;
      } else if (guest.check_in_status === "Checked Out") {
        next.completedCount += 1;
      }
    }

    return next;
  }, [guests, propertyFilter]);

  const arrivalPage = useMemo(
    () => getPagedGuests(board.arrivals, arrivalPageIndex),
    [board.arrivals, arrivalPageIndex]
  );
  const departurePage = useMemo(
    () => getPagedGuests(board.departures, departurePageIndex),
    [board.departures, departurePageIndex]
  );

  const handlePropertyFilterChange = (value: string) => {
    setPropertyFilter(value);
    setArrivalPageIndex(0);
    setDeparturePageIndex(0);
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <CheckInOutHeader propertyFilter={propertyFilter} setPropertyFilter={handlePropertyFilterChange} properties={[]} />
        <CheckInOutSkeleton />
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-svh flex-col" data-testid="check-in-out-page">
      <CheckInOutHeader propertyFilter={propertyFilter} setPropertyFilter={handlePropertyFilterChange} properties={properties} />
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
                <span className="text-2xl font-bold tracking-tight" data-testid="arrivals-count">{board.arrivals.length}</span>
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
                <span className="text-2xl font-bold tracking-tight" data-testid="departures-count">{board.departures.length}</span>
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
                <span className="text-2xl font-bold tracking-tight" data-testid="in-house-count">{board.inHouseCount}</span>
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
                <span className="text-2xl font-bold tracking-tight" data-testid="completed-count">{board.completedCount}</span>
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
                    Arrivals ({board.arrivals.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {board.arrivals.length === 0 ? (
                  <div className="py-8 text-center">
                    <LogIn className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No arrivals pending</p>
                  </div>
                ) : (
                  arrivalPage.guests.map((guest) => (
                    <GuestCard key={guest.id} guest={guest} room={guest.room_id ? roomById.get(guest.room_id) : undefined} property={propertyById.get(guest.property_id)} type="arrival" />
                  ))
                )}
                <GuestListPagination page={arrivalPage} total={board.arrivals.length} onPageChange={setArrivalPageIndex} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-harbor-deep/10 p-1.5 text-harbor-deep">
                    <LogOut className="h-3.5 w-3.5" />
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    Departures ({board.departures.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {board.departures.length === 0 ? (
                  <div className="py-8 text-center">
                    <LogOut className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No departures pending</p>
                  </div>
                ) : (
                  departurePage.guests.map((guest) => (
                    <GuestCard key={guest.id} guest={guest} room={guest.room_id ? roomById.get(guest.room_id) : undefined} property={propertyById.get(guest.property_id)} type="departure" />
                  ))
                )}
                <GuestListPagination page={departurePage} total={board.departures.length} onPageChange={setDeparturePageIndex} />
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
