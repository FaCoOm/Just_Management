import { useMemo, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoomsPageData } from "@/hooks/use-page-data";
import { useVietnamClock } from "@/hooks/use-vietnam-clock";
import { deriveRoomDisplayStatus } from "@/lib/room-status";
import { BedDouble, Layers } from "lucide-react";
import type { Property } from "@/types/database";

interface RoomTypeGroup {
  type: string;
  count: number;
  occupied: number;
  vacant: number;
  properties: string[];
}

function RoomTypesSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

export function RoomTypesPage() {
  const { rooms, properties, reservations, loading } = useRoomsPageData();
  const { today } = useVietnamClock();
  const [propertyFilter, setPropertyFilter] = useState<string>("all");

  const roomsWithStatus = useMemo(
    () => rooms.map((room) => ({
      ...room,
      status: deriveRoomDisplayStatus(room, reservations, today),
    })),
    [rooms, reservations, today]
  );

  const filteredRooms = useMemo(() => {
    if (propertyFilter === "all") return roomsWithStatus;
    return roomsWithStatus.filter((r) => r.property_id === propertyFilter);
  }, [roomsWithStatus, propertyFilter]);

  const typeGroups = useMemo<RoomTypeGroup[]>(() => {
    const map = new Map<string, RoomTypeGroup>();
    for (const room of filteredRooms) {
      const existing = map.get(room.room_type);
      const isOccupied = ["Occupied", "Checked In", "Check-In Pending", "Check-Out Pending"].includes(room.status);
      const propName = properties.find((p) => p.id === room.property_id)?.name ?? "";
      if (existing) {
        existing.count++;
        if (isOccupied) existing.occupied++;
        else existing.vacant++;
        if (!existing.properties.includes(propName)) existing.properties.push(propName);
      } else {
        map.set(room.room_type, {
          type: room.room_type,
          count: 1,
          occupied: isOccupied ? 1 : 0,
          vacant: isOccupied ? 0 : 1,
          properties: [propName],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filteredRooms, properties]);

  const uniqueTypes = typeGroups.length;
  const totalRooms = filteredRooms.length;
  const occupiedTotal = filteredRooms.filter((r) => ["Occupied", "Checked In"].includes(r.status)).length;
  const avgOccupancy = totalRooms > 0 ? Math.round((occupiedTotal / totalRooms) * 100) : 0;

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <RoomTypesHeader propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter} properties={[]} />
        <RoomTypesSkeleton />
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-svh flex-col" data-testid="room-types-page">
      <RoomTypesHeader propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter} properties={properties} />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Room Types</CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1">
                  <Layers className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight" data-testid="type-count">{uniqueTypes}</span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Rooms</CardTitle>
                <div className="rounded-md bg-harbor-deep/10 p-1.5 text-harbor-deep">
                  <BedDouble className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight" data-testid="total-rooms">{totalRooms}</span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Occupied</CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4">
                  <BedDouble className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight" data-testid="occupied-count">{occupiedTotal}</span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Avg Occupancy</CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <Layers className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight" data-testid="avg-occupancy">{avgOccupancy}%</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {typeGroups.map((group) => {
              const occRate = group.count > 0 ? Math.round((group.occupied / group.count) * 100) : 0;
              return (
                <Card key={group.type} className="transition-shadow hover:shadow-sm" data-testid={`room-type-card-${group.type}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{group.type}</CardTitle>
                      <Badge variant="outline" className="text-[10px]">
                        {group.count} rooms
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      {group.properties.slice(0, 3).join(", ")}
                      {group.properties.length > 3 && ` +${group.properties.length - 3} more`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Occupancy</span>
                      <span className="font-semibold">{occRate}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary">
                      <div
                        className="h-1.5 rounded-full bg-harbor transition-all"
                        style={{ width: `${occRate}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-emerald-50 px-2 py-1.5 text-center dark:bg-emerald-950">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{group.vacant}</span>
                        <span className="text-muted-foreground ml-1">vacant</span>
                      </div>
                      <div className="rounded-md bg-chart-1/5 px-2 py-1.5 text-center">
                        <span className="font-semibold text-chart-1">{group.occupied}</span>
                        <span className="text-muted-foreground ml-1">occupied</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {typeGroups.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Layers className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No room types found for the selected property</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomTypesHeader({ propertyFilter, setPropertyFilter, properties }: {
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
          <h2 className="text-sm font-semibold">Room Types</h2>
          <p className="text-xs text-muted-foreground">Manage room categories and configurations</p>
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
