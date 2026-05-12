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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { formatVietnamDate, getVietnamToday } from "@/lib/vietnam-time";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Plus,
  CalendarDays,
  ListFilter as Filter,
  Star,
  LogIn,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { CheckInStatus, Guest, Property, Room } from "@/types/database";

const statusConfig: Record<
  CheckInStatus,
  { label: string; className: string }
> = {
  "Checked In": {
    label: "Checked In",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  },
  "Check-In Pending": {
    label: "Arriving",
    className:
      "bg-chart-1/10 text-chart-1 border-chart-1/20",
  },
  Pending: {
    label: "Pending",
    className: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  },
  "Check-Out Pending": {
    label: "Departing",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  },
  "Checked Out": {
    label: "Checked Out",
    className: "bg-muted text-muted-foreground border-border",
  },
};

type ReservationsTableMeta = {
  rooms: Room[];
  properties: Property[];
};

function ReservationsSkeleton() {
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

function buildColumns(rooms: Room[], properties: Property[]): ColumnDef<Guest>[] {
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
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-secondary text-[10px]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs font-medium leading-tight">
                {guest.guest_name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {guest.guest_count}{" "}
                {guest.guest_count === 1 ? "guest" : "guests"}
                {guest.is_vip && (
                  <span className="ml-1 text-chart-4">· VIP</span>
                )}
              </p>
            </div>
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
        const meta = table.options.meta as ReservationsTableMeta;
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
        const meta = table.options.meta as ReservationsTableMeta;
        const room = meta.rooms.find((r) => r.id === row.original.room_id);
        if (!room) {
          return (
            <span className="text-xs text-muted-foreground">Unassigned</span>
          );
        }
        return (
          <span className="text-xs">
            {room.room_number}
            <span className="ml-1 text-muted-foreground">· {room.room_type}</span>
          </span>
        );
      },
    },
    {
      id: "checkIn",
      accessorKey: "eta",
      sortingFn: (a, b) => {
        const da = a.original.eta
          ? new Date(a.original.eta).getTime()
          : 0;
        const db = b.original.eta
          ? new Date(b.original.eta).getTime()
          : 0;
        return da - db;
      },
      header: "Check-In",
      cell: ({ row }) => {
        const eta = row.original.eta ? formatVietnamDate(row.original.eta) : "—";
        return <span className="text-xs">{eta}</span>;
      },
    },
    {
      id: "checkOut",
      accessorKey: "etd",
      sortingFn: (a, b) => {
        const da = a.original.etd
          ? new Date(a.original.etd).getTime()
          : 0;
        const db = b.original.etd
          ? new Date(b.original.etd).getTime()
          : 0;
        return da - db;
      },
      header: "Check-Out",
      cell: ({ row }) => {
        const etd = row.original.etd ? formatVietnamDate(row.original.etd) : "—";
        return <span className="text-xs">{etd}</span>;
      },
    },
    {
      id: "source",
      accessorKey: "booking_source",
      header: "Source",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.booking_source}
        </span>
      ),
    },
    {
      id: "status",
      accessorKey: "check_in_status",
      header: "Status",
      cell: ({ row }) => {
        const guest = row.original;
        const config =
          statusConfig[guest.check_in_status] ?? statusConfig["Pending"];
        return (
          <Badge
            variant="outline"
            className={`text-[10px] ${config.className}`}
          >
            {config.label}
          </Badge>
        );
      },
    },
  ];
}

export function ReservationsPage() {
  const { guests, rooms, properties, loading } = useDashboardData(getVietnamToday());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });

  const filtered = useMemo(() => {
    return guests.filter((g) => {
      const matchSearch = g.guest_name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" || g.check_in_status === statusFilter;
      const matchProperty =
        propertyFilter === "all" || g.property_id === propertyFilter;
      return matchSearch && matchStatus && matchProperty;
    });
  }, [guests, search, statusFilter, propertyFilter]);

  const columns = useMemo(
    () => buildColumns(rooms, properties),
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
    meta: { rooms, properties } satisfies ReservationsTableMeta,
  });

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <ReservationsHeader />
        <ReservationsSkeleton />
      </div>
    );
  }

  const statusCounts = {
    all: guests.length,
    "Checked In": guests.filter((g) => g.check_in_status === "Checked In")
      .length,
    arriving: guests.filter((g) =>
      ["Pending", "Check-In Pending"].includes(g.check_in_status)
    ).length,
    departing: guests.filter(
      (g) => g.check_in_status === "Check-Out Pending"
    ).length,
    vip: guests.filter((g) => g.is_vip).length,
  };

  return (
    <div className="flex h-full max-h-svh flex-col">
      <ReservationsHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Reservations
                </CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight">
                  {statusCounts.all}
                </span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  In-House
                </CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <LogIn className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight">
                  {statusCounts["Checked In"]}
                </span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Arriving Today
                </CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1">
                  <Clock className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight">
                  {statusCounts.arriving}
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
                  {statusCounts.vip}
                </span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-sm font-semibold">
                  All Reservations
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search guest..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        table.setPageIndex(0);
                      }}
                      className="h-8 w-48 pl-8 text-xs"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      setStatusFilter(v);
                      table.setPageIndex(0);
                    }}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <Filter className="mr-1.5 h-3 w-3" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Checked In">Checked In</SelectItem>
                      <SelectItem value="Check-In Pending">Arriving</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Check-Out Pending">Departing</SelectItem>
                      <SelectItem value="Checked Out">Checked Out</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={propertyFilter}
                    onValueChange={(v) => {
                      setPropertyFilter(v);
                      table.setPageIndex(0);
                    }}
                  >
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue placeholder="Property" />
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
                          className={`pl-4 text-xs ${header.column.getCanSort() ? "cursor-pointer select-none hover:bg-muted/50" : ""}`}
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
                        No reservations found
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
                              cell.column.id === "guest" ? "pl-4 py-2.5" : "py-2.5"
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
        </div>
      </div>
    </div>
  );
}

function ReservationsHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Reservations</h2>
          <p className="text-xs text-muted-foreground">
            Manage all bookings across properties
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-8 gap-1.5 text-xs bg-harbor text-harbor-foreground hover:bg-harbor-deep">
          <Plus className="h-3.5 w-3.5" />
          New Reservation
        </Button>
      </div>
    </header>
  );
}
