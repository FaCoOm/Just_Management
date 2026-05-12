import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
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
import { getVietnamToday } from "@/lib/vietnam-time";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Users,
  Star,
  UserCheck,
  UserX,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Guest, Property, Room } from "@/types/database";

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

type GuestsTableMeta = {
  rooms: Room[];
  properties: Property[];
};

function buildGuestColumns(
  rooms: Room[],
  properties: Property[]
): ColumnDef<Guest>[] {
  return [
    {
      id: "guest",
      accessorKey: "guest_name",
      header: "Guest",
      cell: ({ row }) => {
        const guest = row.original;
        const initials = guest.guest_name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2);
        const isInHouse = guest.check_in_status === "Checked In";
        const isPending = ["Pending", "Check-In Pending"].includes(
          guest.check_in_status
        );
        return (
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
            <span className="sr-only">
              {isInHouse ? "in-house" : isPending ? "pending" : ""}
            </span>
          </div>
        );
      },
    },
    {
      id: "property",
      accessorFn: (row) =>
        properties.find((p) => p.id === row.property_id)?.name ?? "",
      header: "Property",
      cell: ({ row, table }) => {
        const meta = table.options.meta as GuestsTableMeta;
        const property = meta.properties.find(
          (p) => p.id === row.original.property_id
        );
        return (
          <span className="text-xs text-muted-foreground">
            {property?.name ?? "—"}
          </span>
        );
      },
    },
    {
      id: "room",
      accessorFn: (row) => {
        const room = rooms.find((r) => r.id === row.room_id);
        if (!room) return "";
        return `${room.room_number} ${room.room_type}`;
      },
      header: "Room",
      cell: ({ row, table }) => {
        const meta = table.options.meta as GuestsTableMeta;
        const room = meta.rooms.find((r) => r.id === row.original.room_id);
        return (
          <span className="text-xs">
            {room ? (
              <>
                {room.room_number}
                <span className="ml-1 text-muted-foreground text-[10px]">
                  {room.room_type}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </span>
        );
      },
    },
    {
      id: "source",
      accessorKey: "booking_source",
      header: "Source",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={`text-[10px] ${sourceColor[row.original.booking_source] ?? "bg-muted text-muted-foreground border-border"}`}
        >
          {row.original.booking_source}
        </Badge>
      ),
    },
    {
      id: "status",
      accessorKey: "check_in_status",
      header: "Status",
      cell: ({ row }) => {
        const guest = row.original;
        const isInHouse = guest.check_in_status === "Checked In";
        const isPending = ["Pending", "Check-In Pending"].includes(
          guest.check_in_status
        );
        return (
          <div>
            <div
              className={`h-2 w-2 rounded-full inline-block ${isInHouse ? "bg-emerald-500" : isPending ? "bg-chart-1" : "bg-muted-foreground/40"}`}
            />
            <span className="ml-2 text-xs text-muted-foreground">
              {guest.check_in_status}
            </span>
          </div>
        );
      },
    },
  ];
}

export function GuestsPage() {
  const { guests, rooms, properties, loading } = useDashboardData(getVietnamToday());
  const [search, setSearch] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 12,
  });

  const filtered = useMemo(() => {
    return guests.filter((g) => {
      const matchSearch = g.guest_name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchVip = !vipOnly || g.is_vip;
      return matchSearch && matchVip;
    });
  }, [guests, search, vipOnly]);

  const columns = useMemo(
    () => buildGuestColumns(rooms, properties),
    [rooms, properties]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    meta: { rooms, properties } satisfies GuestsTableMeta,
  });

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <GuestsHeader />
        <GuestsSkeleton />
      </div>
    );
  }

  const totalGuests = guests.reduce((sum, g) => sum + g.guest_count, 0);
  const inHouse = guests.filter((g) => g.check_in_status === "Checked In");
  const vipGuests = guests.filter((g) => g.is_vip);
  const checkedOut = guests.filter((g) => g.check_in_status === "Checked Out");

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
                        onChange={(e) => {
                          setSearch(e.target.value);
                          table.setPageIndex(0);
                        }}
                        className="h-8 w-44 pl-8 text-xs"
                      />
                    </div>
                    <Button
                      variant={vipOnly ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setVipOnly(!vipOnly);
                        table.setPageIndex(0);
                      }}
                      className={`h-8 gap-1.5 text-xs ${vipOnly ? "bg-chart-4 text-white hover:bg-chart-4/90 border-chart-4" : ""}`}
                    >
                      <Star className="h-3 w-3" />
                      VIP Only
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-0 pb-3">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id} className="border-t border-border">
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className={`text-xs ${header.column.getCanSort() ? "cursor-pointer select-none hover:bg-muted/50" : ""} ${header.column.id === "guest" ? "pl-4" : ""}`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                            {{
                              asc: " ↑",
                              desc: " ↓",
                            }[header.column.getIsSorted() as string] ?? ""}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          No guests found
                        </TableCell>
                      </TableRow>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer hover:bg-muted/40"
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell
                              key={cell.id}
                              className={
                                cell.column.id === "guest"
                                  ? "pl-4 py-2.5"
                                  : "py-2.5"
                              }
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="flex flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Page {table.getState().pagination.pageIndex + 1} of{" "}
                    {table.getPageCount() || 1} · {filtered.length} row(s)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      disabled={!table.getCanPreviousPage()}
                      onClick={() => table.previousPage()}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Prev
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      disabled={!table.getCanNextPage()}
                      onClick={() => table.nextPage()}
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    Booking Sources
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topSources.map(([source, count]) => {
                    const pct =
                      guests.length > 0
                        ? Math.round((count / guests.length) * 100)
                        : 0;
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
