import { Fragment, useLayoutEffect, useMemo, useRef } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addDaysToVietnamDate,
  compareVietnamDateKeys,
  formatVietnamDate,
  getVietnamDateKey,
} from "@/lib/vietnam-time";
import type { Property, Reservation, Room } from "@/types/database";

type CellStatus = "vacant" | "arriving" | "occupied" | "departing";

interface RoomCalendarPanelProps {
  readonly properties: Property[];
  readonly rooms: Room[];
  readonly reservations: Reservation[];
  readonly today: string;
}

type RoomRow = Room & { propertyName: string };
type PropertyGroup = { propertyId: string; propertyName: string; rooms: RoomRow[] };

function roomReservationIds(reservation: Reservation) {
  const allocations = reservation.reservation_room_allocations ?? [];
  if (allocations.length > 0) return allocations.map((allocation) => allocation.room_id);
  return reservation.primary_room_id ? [reservation.primary_room_id] : [];
}

function roomNumberValue(room: Room) {
  const numeric = Number.parseInt(room.room_number.replace(/\D/g, ""), 10);
  return Number.isNaN(numeric) ? Number.MAX_SAFE_INTEGER : numeric;
}

function reservationStatusClass(status: CellStatus) {
  switch (status) {
    case "arriving":
      return "bg-chart-1/15 text-chart-1";
    case "departing":
      return "bg-amber-100/70 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    case "occupied":
      return "bg-chart-4/15 text-chart-4";
    default:
      return "bg-background text-muted-foreground";
  }
}

export function RoomCalendarPanel({ properties, rooms, reservations, today }: RoomCalendarPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dateColumns = useMemo(() => {
    const start = addDaysToVietnamDate(today, -30);
    const end = addDaysToVietnamDate(today, 365);
    const dates: string[] = [];
    for (let date = start; compareVietnamDateKeys(date, end) <= 0; date = addDaysToVietnamDate(date, 1)) {
      dates.push(date);
    }
    return dates;
  }, [today]);

  const groupedProperties = useMemo<PropertyGroup[]>(() => {
    const propertyNameById = new Map(properties.map((property) => [property.id, property.name]));
    const roomRows = rooms
      .map<RoomRow>((room) => ({ ...room, propertyName: propertyNameById.get(room.property_id) ?? "Unknown property" }))
      .sort((a, b) => {
        const propertyCompare = a.propertyName.localeCompare(b.propertyName);
        if (propertyCompare !== 0) return propertyCompare;
        const floorCompare = a.floor - b.floor;
        if (floorCompare !== 0) return floorCompare;
        return roomNumberValue(a) - roomNumberValue(b);
      });

    const grouped = new Map<string, RoomRow[]>();
    for (const room of roomRows) {
      const list = grouped.get(room.property_id) ?? [];
      list.push(room);
      grouped.set(room.property_id, list);
    }

    return Array.from(grouped.entries()).map(([propertyId, groupedRooms]) => ({
      propertyId,
      propertyName: groupedRooms[0]?.propertyName ?? propertyNameById.get(propertyId) ?? "Unknown property",
      rooms: groupedRooms,
    }));
  }, [properties, rooms]);

  const reservationByRoom = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const reservation of reservations) {
      if (reservation.status === "cancelled" || reservation.status === "checked_out" || reservation.status === "no_show") continue;
      for (const roomId of roomReservationIds(reservation)) {
        const list = map.get(roomId) ?? [];
        list.push(reservation);
        map.set(roomId, list);
      }
    }
    return map;
  }, [reservations]);

  useLayoutEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const frameId = window.requestAnimationFrame(() => {
      const todayColumn = scrollElement.querySelector<HTMLElement>(`[data-date="${today}"]`);
      if (!todayColumn) return;

      scrollElement.scrollLeft = Math.max(todayColumn.offsetLeft - 224, 0);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [today, dateColumns]);

  return (
    <Card className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden py-4">
      <CardHeader className="gap-2 pb-0">
        <CardTitle className="font-serif text-lg">Room calendar</CardTitle>
        <p className="text-xs text-muted-foreground">-30 days → +365 days. Next 14 days highlighted; today is strongest.</p>
      </CardHeader>
      <CardContent className="min-h-0 min-w-0 flex-1 p-0">
        <div ref={scrollRef} className="h-full min-w-0 overflow-auto" aria-label="Scrollable room calendar, initially focused on today and the next 14 days">
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-30 w-56 border-b border-border bg-card px-3 py-3 text-left">Room</th>
                {dateColumns.map((date) => {
                  const meta = {
                    isToday: date === today,
                    isPriority: compareVietnamDateKeys(date, addDaysToVietnamDate(today, 13)) <= 0 && compareVietnamDateKeys(date, today) >= 0,
                  };
                  const f = formatVietnamDate(date, { month: "short", day: "numeric" });
                  return (
                    <th
                      key={date}
                      data-date={date}
                      scope="col"
                      aria-label={`${f}${meta.isToday ? ", today" : ""}${meta.isPriority ? ", priority" : ""}`}
                      className={`min-w-11 border-b border-border px-1 py-2 text-center ${meta.isPriority ? "bg-harbor/5" : "bg-card"} ${meta.isToday ? "ring-1 ring-inset ring-harbor/30" : ""}`}
                    >
                      <div className={`rounded-md px-1 py-1 ${meta.isToday ? "bg-harbor/10 text-harbor" : meta.isPriority ? "bg-chart-1/10 text-chart-1" : ""}`}>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{formatVietnamDate(date, { weekday: "short" })}</div>
                        <div className={`text-[11px] font-medium ${meta.isToday ? "font-bold" : ""}`}>{f}</div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="[&_tr]:content-auto">
              {groupedProperties.map((group) => (
                <Fragment key={group.propertyId}>
                  <tr>
                    <td className="sticky left-0 z-20 border-b border-border bg-muted/40 px-3 py-2 font-medium text-muted-foreground" colSpan={dateColumns.length + 1}>
                      {group.propertyName}
                    </td>
                  </tr>
                  {group.rooms.map((room) => (
                    <tr key={room.id} className="group">
                      <td className="sticky left-0 z-20 border-b border-border bg-card px-3 py-2 align-top">
                        <div className="font-medium text-foreground">{room.room_number}</div>
                        <div className="text-[10px] text-muted-foreground">F{room.floor} · {room.room_type}</div>
                      </td>
                      {dateColumns.map((date) => {
                        const active = (reservationByRoom.get(room.id) ?? []).find((reservation) => {
                          const checkIn = getVietnamDateKey(reservation.check_in_date);
                          const checkOut = getVietnamDateKey(reservation.check_out_date);
                          return compareVietnamDateKeys(checkIn, date) <= 0 && compareVietnamDateKeys(date, checkOut) < 0;
                        });
                        const status: CellStatus = !active
                          ? "vacant"
                          : compareVietnamDateKeys(date, getVietnamDateKey(active.check_in_date)) === 0
                            ? "arriving"
                            : compareVietnamDateKeys(date, addDaysToVietnamDate(getVietnamDateKey(active.check_out_date), -1)) === 0
                              ? "departing"
                              : "occupied";
                        const initial = active?.guest_name.trim().slice(0, 2).toUpperCase() ?? "";
                        const todayBand = compareVietnamDateKeys(date, today) === 0 ? "ring-1 ring-inset ring-harbor/30" : "";
                        const priorityBand = compareVietnamDateKeys(date, today) >= 0 && compareVietnamDateKeys(date, addDaysToVietnamDate(today, 13)) <= 0 ? "bg-harbor/5" : "";
                        const title = active ? `${active.guest_name} · ${status}` : "Vacant";
                        return (
                          <td key={date} className={`min-w-11 border-b border-border px-0.5 py-1 align-top ${priorityBand} ${todayBand}`} aria-label={`${room.room_number} ${title} on ${date}`} title={title}>
                            <div className={`flex h-8 items-center justify-center rounded-sm text-[10px] font-medium ${reservationStatusClass(status)}`}>
                              {active ? <span className="truncate px-1">{initial}</span> : null}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
