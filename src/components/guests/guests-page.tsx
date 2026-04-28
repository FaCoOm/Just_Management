import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Star, UserCheck, UserX, Download } from "lucide-react";

function GuestsSkeleton() {
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

const sourceColor: Record<string, string> = {
  Direct: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  Booking: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  Expedia: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  Airbnb: "bg-destructive/10 text-destructive border-destructive/20",
  Agoda: "bg-muted text-muted-foreground border-border",
};

export function GuestsPage() {
  const { guests, rooms, properties, loading } = useDashboardData();
  const [search, setSearch] = useState("");
  const [vipOnly, setVipOnly] = useState(false);

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <GuestsHeader />
        <GuestsSkeleton />
      </div>
    );
  }

  const filtered = guests.filter((g) => {
    const matchSearch = g.guest_name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchVip = !vipOnly || g.is_vip;
    return matchSearch && matchVip;
  });

  const totalGuests = guests.reduce((sum, g) => sum + g.guest_count, 0);
  const inHouse = guests.filter((g) => g.check_in_status === "Checked In");
  const vipGuests = guests.filter((g) => g.is_vip);
  const checkedOut = guests.filter((g) => g.check_in_status === "Checked Out");

  // Source distribution
  const sourceCounts = guests.reduce<Record<string, number>>((acc, g) => {
    acc[g.booking_source] = (acc[g.booking_source] ?? 0) + 1;
    return acc;
  }, {});

  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="flex h-full max-h-svh flex-col">
      <GuestsHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Guest Records
                </CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1">
                  <Users className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight">
                    {guests.length}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {totalGuests} pax
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Currently In-House
                </CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <UserCheck className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight">
                  {inHouse.length}
                </span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  VIP Guests
                </CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4">
                  <Star className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight">
                  {vipGuests.length}
                </span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Checked Out
                </CardTitle>
                <div className="rounded-md bg-muted p-1.5 text-muted-foreground">
                  <UserX className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight">
                  {checkedOut.length}
                </span>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Guest Table */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-sm font-semibold">
                    Guest Profiles
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search guest..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 w-44 pl-8 text-xs"
                      />
                    </div>
                    <Button
                      variant={vipOnly ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVipOnly(!vipOnly)}
                      className={`h-8 gap-1.5 text-xs ${vipOnly ? "bg-chart-4 text-white hover:bg-chart-4/90 border-chart-4" : ""}`}
                    >
                      <Star className="h-3 w-3" />
                      VIP Only
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-t border-border">
                      <TableHead className="pl-4 text-xs">Guest</TableHead>
                      <TableHead className="text-xs">Property</TableHead>
                      <TableHead className="text-xs">Room</TableHead>
                      <TableHead className="text-xs">Source</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          No guests found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((guest) => {
                        const room = rooms.find((r) => r.id === guest.room_id);
                        const property = properties.find(
                          (p) => p.id === guest.property_id
                        );
                        const initials = guest.guest_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2);

                        const isInHouse =
                          guest.check_in_status === "Checked In";
                        const isPending = ["Pending", "Check-In Pending"].includes(
                          guest.check_in_status
                        );

                        return (
                          <TableRow
                            key={guest.id}
                            className="cursor-pointer hover:bg-muted/40"
                          >
                            <TableCell className="pl-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback
                                    className={`text-[10px] ${guest.is_vip ? "bg-chart-4/20 text-chart-4" : "bg-secondary"}`}
                                  >
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-medium leading-tight">
                                      {guest.guest_name}
                                    </p>
                                    {guest.is_vip && (
                                      <Star className="h-2.5 w-2.5 text-chart-4 fill-chart-4" />
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    {guest.guest_count} pax
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-xs text-muted-foreground">
                              {property?.name ?? "—"}
                            </TableCell>
                            <TableCell className="py-2.5 text-xs">
                              {room ? (
                                <span>
                                  {room.room_number}
                                  <span className="ml-1 text-muted-foreground text-[10px]">
                                    {room.room_type}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${sourceColor[guest.booking_source] ?? "bg-muted text-muted-foreground border-border"}`}
                              >
                                {guest.booking_source}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div
                                className={`h-2 w-2 rounded-full inline-block ${isInHouse ? "bg-emerald-500" : isPending ? "bg-chart-1" : "bg-muted-foreground/40"}`}
                              />
                              <span className="ml-2 text-xs text-muted-foreground">
                                {guest.check_in_status}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Booking Source Breakdown */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    Booking Sources
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topSources.map(([source, count]) => {
                    const pct = Math.round((count / guests.length) * 100);
                    return (
                      <div key={source} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{source}</span>
                          <span className="text-xs text-muted-foreground">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-secondary">
                          <div
                            className="h-1.5 rounded-full bg-harbor"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    By Property
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {properties.map((prop) => {
                    const propGuests = guests.filter(
                      (g) => g.property_id === prop.id
                    );
                    const inHouseProp = propGuests.filter(
                      (g) => g.check_in_status === "Checked In"
                    ).length;
                    return (
                      <div
                        key={prop.id}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                      >
                        <div>
                          <p className="text-xs font-medium">{prop.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {prop.location}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {propGuests.length}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {inHouseProp} in-house
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuestsHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Guest Profiles</h2>
          <p className="text-xs text-muted-foreground">
            All guests across all properties
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>
    </header>
  );
}
