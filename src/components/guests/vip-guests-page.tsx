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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useGuestsPageData } from "@/hooks/use-page-data";
import { formatVietnamDate } from "@/lib/vietnam-time";
import { Star, Crown, Users, Search, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { Guest, Property, Room } from "@/types/database";

function VipGuestsSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-lg" />))}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

export function VipGuestsPage() {
  const { guests, rooms, properties, loading } = useGuestsPageData();
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 12 });

  const vipGuests = useMemo(() => guests.filter((g) => g.is_vip), [guests]);
  const filtered = useMemo(() => vipGuests.filter((g) => {
    const matchSearch = g.guest_name.toLowerCase().includes(search.toLowerCase());
    const matchProperty = propertyFilter === "all" || g.property_id === propertyFilter;
    return matchSearch && matchProperty;
  }), [vipGuests, search, propertyFilter]);

  const columns = useMemo<ColumnDef<Guest>[]>(() => [
    { id: "guest", accessorKey: "guest_name", header: "VIP Guest", cell: ({ row }) => {
      const guest = row.original;
      const initials = guest.guest_name.split(" ").map((n) => n[0]).join("").slice(0, 2);
      return (
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-chart-4/20 text-chart-4 text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium">{guest.guest_name}</p>
              <Star className="h-3 w-3 text-chart-4 fill-chart-4" />
            </div>
            <p className="text-[10px] text-muted-foreground">{guest.guest_count} {guest.guest_count === 1 ? "guest" : "guests"}</p>
          </div>
        </div>
      );
    }},
    { id: "property", accessorFn: (row) => properties.find((p) => p.id === row.property_id)?.name ?? "", header: "Property", cell: ({ row }) => <span className="text-xs text-muted-foreground">{properties.find((p) => p.id === row.original.property_id)?.name ?? "—"}</span> },
    { id: "room", header: "Room", cell: ({ row }) => { const room = rooms.find((r) => r.id === row.original.room_id); return room ? <span className="text-xs">{room.room_number} <span className="text-muted-foreground">· {room.room_type}</span></span> : <span className="text-xs text-muted-foreground">—</span>; }},
    { id: "source", accessorKey: "booking_source", header: "Source", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.booking_source}</span> },
    { id: "checkIn", header: "Check-in", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.eta ? formatVietnamDate(row.original.eta) : "—"}</span> },
    { id: "status", accessorKey: "check_in_status", header: "Status", cell: ({ row }) => {
      const s = row.original.check_in_status;
      const isIn = s === "Checked In";
      return (
        <Badge variant="outline" className={`text-[10px] ${isIn ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" : "bg-chart-4/10 text-chart-4 border-chart-4/20"}`}>
          {s}
        </Badge>
      );
    }},
  ], [rooms, properties]);

  const table = useReactTable({
    data: filtered, columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const inHouseVip = vipGuests.filter((g) => g.check_in_status === "Checked In").length;
  const arrivingVip = vipGuests.filter((g) => ["Pending", "Check-In Pending"].includes(g.check_in_status)).length;

  if (loading) {
    return (<div className="flex h-full flex-col"><VipHeader /><VipGuestsSkeleton /></div>);
  }

  return (
    <div className="flex h-full max-h-svh flex-col" data-testid="vip-guests-page">
      <VipHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total VIP Guests</CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4"><Crown className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="vip-total">{vipGuests.length}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">In-House VIP</CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"><Star className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="vip-in-house">{inHouseVip}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Arriving VIP</CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1"><CalendarDays className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="vip-arriving">{arrivingVip}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Properties</CardTitle>
                <div className="rounded-md bg-harbor/10 p-1.5 text-harbor"><Users className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="vip-properties">{new Set(vipGuests.map((g) => g.property_id)).size}</span></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-sm font-semibold">VIP Guest List</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search VIP..." value={search} onChange={(e) => { setSearch(e.target.value); table.setPageIndex(0); }} className="h-8 w-44 pl-8 text-xs" data-testid="search-vip" />
                  </div>
                  <Select value={propertyFilter} onValueChange={(v) => { setPropertyFilter(v); table.setPageIndex(0); }}>
                    <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Property" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-0 pb-3">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id} className="border-t border-border">
                      {hg.headers.map((h) => (
                        <TableHead key={h.id} className={`text-xs ${h.column.getCanSort() ? "cursor-pointer select-none hover:bg-muted/50" : ""} ${h.column.id === "guest" ? "pl-4" : ""}`} onClick={h.column.getToggleSortingHandler()}>
                          {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length === 0 ? (
                    <TableRow><TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">
                      <Crown className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                      No VIP guests found
                    </TableCell></TableRow>
                  ) : table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/40">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cell.column.id === "guest" ? "pl-4 py-2.5" : "py-2.5"}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1} · {filtered.length} VIP guest(s)</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><ChevronLeft className="h-3.5 w-3.5" /> Prev</Button>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Next <ChevronRight className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function VipHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">VIP Guests</h2>
          <p className="text-xs text-muted-foreground">Premium guest profiles and reservation history</p>
        </div>
      </div>
    </header>
  );
}
