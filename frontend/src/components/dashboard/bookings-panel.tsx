import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  addDaysToVietnamDate,
  formatVietnamDate,
  formatVietnamMonthLabel,
  getVietnamWeekStrip,
  isSameVietnamDate,
  isVietnamDateWithinStay,
} from "@/lib/vietnam-time";
import type { Guest, Room, Property } from "@/types/database";

interface BookingsPanelProps {
  guests: Guest[];
  rooms: Room[];
  properties: Property[];
  today: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

export function BookingsPanel({
  guests,
  rooms,
  properties,
  today,
}: BookingsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  const weekDays = useMemo(
    () =>
      getVietnamWeekStrip(selectedDate).map((day) => ({
        ...day,
        active: day.dateKey === selectedDate,
      })),
    [selectedDate]
  );

  const arrivals = guests.filter(
    (guest) =>
      ["Pending", "Check-In Pending"].includes(guest.check_in_status) &&
      isSameVietnamDate(guest.eta, selectedDate)
  );
  const inHouse = guests.filter(
    (guest) =>
      ["Checked In", "Check-Out Pending"].includes(guest.check_in_status) &&
      isVietnamDateWithinStay(selectedDate, guest.eta, guest.etd)
  );
  const departures = guests.filter(
    (guest) =>
      ["Check-Out Pending", "Checked Out"].includes(guest.check_in_status) &&
      isSameVietnamDate(guest.etd, selectedDate)
  );

  const filteredBySearch = (list: Guest[]) =>
    searchQuery
      ? list.filter((g) =>
          g.guest_name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : list;

  function BookingCard({ guest }: { guest: Guest }) {
    const room = rooms.find((r) => r.id === guest.room_id);
    const property = properties.find((p) => p.id === guest.property_id);
    const initials = getInitials(guest.guest_name);
    const arrivalDate = guest.eta ? formatVietnamDate(guest.eta) : "TBD";
    const departureDate = guest.etd ? formatVietnamDate(guest.etd) : "TBD";

    const timelineLabel =
      guest.check_in_status === "Checked In" ||
      guest.check_in_status === "Check-Out Pending"
        ? `${arrivalDate} - ${departureDate} stay`
        : guest.check_in_status === "Checked Out"
          ? `Checked out ${departureDate}`
          : `Arrives ${arrivalDate}`;

    const statusConfig = guest.is_vip
      ? { label: "VIP", className: "bg-emerald-100 text-emerald-700 border-emerald-200" }
      : guest.check_in_status === "Checked In"
      ? { label: "Confirmed", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
      : guest.check_in_status === "Checked Out"
        ? { label: "Checked Out", className: "bg-muted text-muted-foreground border-border" }
        : { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" };

    return (
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold">
              {guest.guest_name} - {room?.room_type ?? "Room"}{" "}
              {room?.room_number ?? ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {timelineLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-secondary text-[10px]">
              {initials}
            </AvatarFallback>
          </Avatar>
          {guest.guest_count > 1 && (
            <span className="text-xs text-muted-foreground ml-1">
              +{guest.guest_count - 1}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>via {guest.booking_source}</span>
          <Badge variant="outline" className={statusConfig.className}>
            {statusConfig.label}
          </Badge>
        </div>
        {property && (
          <p className="text-[11px] text-muted-foreground">{property.name}</p>
        )}
      </div>
    );
  }

  function GuestList({ list }: { list: Guest[] }) {
    const filtered = filteredBySearch(list);
    if (filtered.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No bookings found
        </p>
      );
    }
    return (
      <div className="space-y-2">
        {filtered.map((guest) => (
          <BookingCard key={guest.id} guest={guest} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-base font-semibold tracking-[-0.005em]">Bookings</h3>
        <Button variant="link" size="sm" className="text-xs">
          See All
        </Button>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Previous month"
            onClick={() => setSelectedDate(addDaysToVietnamDate(selectedDate, -30))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {formatVietnamMonthLabel(selectedDate)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Next month"
            onClick={() => setSelectedDate(addDaysToVietnamDate(selectedDate, 30))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            aria-label="Previous day"
            onClick={() => setSelectedDate(addDaysToVietnamDate(selectedDate, -1))}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          {weekDays.map((d) => (
            <button
              key={d.dateKey}
              type="button"
              onClick={() => setSelectedDate(d.dateKey)}
              aria-pressed={d.active}
              aria-label={`Select ${d.day} ${d.date}`}
              className={`flex flex-1 flex-col items-center rounded-lg py-1.5 text-xs transition-colors ${
                d.active
                  ? "bg-harbor text-harbor-foreground"
                  : "hover:bg-secondary"
              }`}
            >
              <span className="text-[10px] opacity-70">{d.day}</span>
              <span className="text-sm font-semibold">{d.date}</span>
            </button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            aria-label="Next day"
            onClick={() => setSelectedDate(addDaysToVietnamDate(selectedDate, 1))}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search bookings..."
            className="h-8 pl-8 pr-8 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0.5 top-0.5 h-7 w-7"
            aria-label="Filter bookings"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="arrivals" className="flex flex-1 flex-col">
        <TabsList variant="line" className="mx-4 mt-1">
          <TabsTrigger value="arrivals" className="text-xs">
            Arrivals
          </TabsTrigger>
          <TabsTrigger value="in-house" className="text-xs">
            In-House
          </TabsTrigger>
          <TabsTrigger value="departures" className="text-xs">
            Departures
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4 py-2">
          <TabsContent value="arrivals" className="mt-0">
            <GuestList list={arrivals} />
          </TabsContent>
          <TabsContent value="in-house" className="mt-0">
            <GuestList list={inHouse} />
          </TabsContent>
          <TabsContent value="departures" className="mt-0">
            <GuestList list={departures} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
