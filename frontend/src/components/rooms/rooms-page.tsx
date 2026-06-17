import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRoomsPageData, useUpdateRoomStatus } from "@/hooks/use-page-data";
import { useVietnamClock } from "@/hooks/use-vietnam-clock";
import { deriveRoomDisplayStatus } from "@/lib/room-status";
import { roomStatusConfig } from "@/lib/room-status-config";
import { RoomStatusChooser } from "@/components/rooms/room-status-chooser";
import { Skeleton } from "@/components/ui/skeleton";
import { BedDouble, Layers, Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { RoomStatus, Room } from "@/types/database";

type RoomWithStatus = Room & { status: RoomStatus };

function RoomsSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

export function RoomsPage() {
  const { rooms, properties, reservations, guests, loading } = useRoomsPageData();
  const { today } = useVietnamClock();
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [chooserRoom, setChooserRoom] = useState<RoomWithStatus | null>(null);
  const updateRoomStatus = useUpdateRoomStatus();

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <RoomsHeader />
        <RoomsSkeleton />
      </div>
    );
  }

  const roomsWithStatus = rooms.map((room) => ({
    ...room,
    status: deriveRoomDisplayStatus(room, reservations, today),
  }));

  const roomTypes = Array.from(new Set(roomsWithStatus.map((r) => r.room_type))).sort();

  const filtered = roomsWithStatus.filter((r) => {
    const matchProperty =
      propertyFilter === "all" || r.property_id === propertyFilter;
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchType = typeFilter === "all" || r.room_type === typeFilter;
    return matchProperty && matchStatus && matchType;
  });

  const vacantCount = roomsWithStatus.filter((r) => r.status === "Vacant").length;
  const occupiedCount = roomsWithStatus.filter((r) =>
    ["Occupied", "Checked In"].includes(r.status)
  ).length;
  const attentionCount = roomsWithStatus.filter(
    (r) => r.status === "Needs Attention"
  ).length;
  const occupancyRate =
    roomsWithStatus.length > 0 ? Math.round((occupiedCount / roomsWithStatus.length) * 100) : 0;

  // Group by floor for the selected property (or all)
  const grouped = properties
    .filter((p) => propertyFilter === "all" || p.id === propertyFilter)
    .map((p) => {
      const propRooms = filtered.filter((r) => r.property_id === p.id);
      const floors = Array.from(new Set(propRooms.map((r) => r.floor))).sort(
        (a, b) => a - b
      );
      return { property: p, floors, propRooms };
    })
    .filter((g) => g.propRooms.length > 0);

  return (
    <div className="flex h-full max-h-svh flex-col">
      <RoomsHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Rooms
                </CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1">
                  <BedDouble className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight">
                  {roomsWithStatus.length}
                </span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Occupancy Rate
                </CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4">
                  <Layers className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight">
                    {occupancyRate}%
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Vacant
                </CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <BedDouble className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight">
                  {vacantCount}
                </span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Needs Attention
                </CardTitle>
                <div className="rounded-md bg-destructive/10 p-1.5 text-destructive">
                  <Settings2 className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight">
                  {attentionCount}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(roomStatusConfig).map(([s, c]) => (
                  <SelectItem key={s} value={s}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {roomTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Legend */}
            <div className="ml-auto flex items-center gap-3">
              {[
                { label: "Vacant", dot: "bg-emerald-500" },
                { label: "Occupied", dot: "bg-chart-1" },
                { label: "Arriving", dot: "bg-chart-4" },
                { label: "Departing", dot: "bg-amber-500" },
                { label: "Attention", dot: "bg-destructive" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${item.dot}`} />
                  <span className="text-[10px] text-muted-foreground">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Floor plans per property */}
          {grouped.map(({ property, floors, propRooms }) => (
            <Card key={property.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      {property.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {property.location} &middot;{" "}
                      {propRooms.filter((r) => ["Occupied","Checked In"].includes(r.status)).length}/
                      {propRooms.length} occupied
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {floors.map((floor) => {
                  const floorRooms = propRooms
                    .filter((r) => r.floor === floor)
                    .sort((a, b) =>
                      a.room_number.localeCompare(b.room_number, undefined, {
                        numeric: true,
                      })
                    );
                  return (
                    <div key={floor} className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Floor {floor}
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                        {floorRooms.map((room) => {
                          const config =
                            roomStatusConfig[room.status] ??
                            roomStatusConfig["Checked Out"];
                          const currentGuest = guests.find(
                            (g) =>
                              g.room_id === room.id &&
                              g.check_in_status !== "Checked Out"
                          );
                          return (
                            <button
                              type="button"
                              key={room.id}
                              aria-label={`${room.room_name} room ${room.room_number} ${room.status}${currentGuest ? ` ${currentGuest.guest_name}` : ""}`}
                              title={`${room.room_name} — ${room.status}${currentGuest ? ` — ${currentGuest.guest_name}` : ""}`}
                              className={`group relative flex flex-col items-center justify-center rounded-md border p-2.5 text-center cursor-pointer hover:shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${config.card} bg-card`}
                              onClick={() => setChooserRoom(room)}
                            >
                              <div
                                className={`mb-1 h-1.5 w-1.5 rounded-full ${config.dot}`}
                              />
                              <p className="text-xs font-semibold leading-none">
                                {room.room_number}
                              </p>
                              <p className="mt-0.5 text-[9px] text-muted-foreground leading-tight truncate w-full">
                                {room.room_type}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {grouped.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No rooms match the selected filters
                </p>
              </CardContent>
            </Card>
          )}
          <RoomStatusChooser
            open={chooserRoom !== null}
            currentStatus={chooserRoom?.status ?? "Vacant"}
            isPending={updateRoomStatus.isPending}
            onOpenChange={(open) => {
              if (!open) setChooserRoom(null);
            }}
            onSelect={(status) => {
              if (!chooserRoom) return;
              updateRoomStatus.mutate(
                { roomId: chooserRoom.id, status },
                {
                  onSuccess: () => setChooserRoom(null),
                  onError: (error) => toast.error(error.message),
                }
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}

function RoomsHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Rooms & Suites</h2>
          <p className="text-xs text-muted-foreground">
            Floor plan view across all properties
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild data-testid="manage-room-types-btn">
          <Link to="/rooms/types">
            <Settings2 className="h-3.5 w-3.5" />
            Manage Room Types
          </Link>
        </Button>
      </div>
    </header>
  );
}
