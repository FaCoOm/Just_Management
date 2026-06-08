import { useEffect, useMemo, useState } from "react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
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
import { useReservationsPageData } from "@/hooks/use-page-data";
import { createRestRepositories } from "@/lib/repositories";
import { dashboardKeys } from "@/lib/query-keys";
import { formatVietnamDate } from "@/lib/vietnam-time";
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
  Receipt,
  Loader2,
} from "lucide-react";
import type { CheckInStatus, Guest, Property, ReservationCreateInput, Room } from "@/types/database";

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
  taxExporting: Record<string, boolean>;
  onTaxExport: (reservationId: string, etd: string | null) => void;
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

const API_BASE = import.meta.env.VITE_TRACK_B_API_URL ?? "http://localhost:3001";

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
    {
      id: "taxExport",
      header: "",
      cell: ({ row, table }) => {
        const meta = table.options.meta as ReservationsTableMeta;
        const id = row.original.id;
        const loading = meta.taxExporting[id] ?? false;
        return (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Export Tax Invoice"
            disabled={loading}
            onClick={() => meta.onTaxExport(id, row.original.etd ?? null)}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
          </Button>
        );
      },
    },
  ];
}

export function ReservationsPage() {
  const { guests, rooms, properties, loading } = useReservationsPageData();
  const [taxExporting, setTaxExporting] = useState<Record<string, boolean>>({});

  async function handleTaxExport(reservationId: string, etd: string | null) {
    const date = etd ? etd.slice(0, 10) : new Date().toISOString().slice(0, 10);
    setTaxExporting((prev) => ({ ...prev, [reservationId]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/tax-export/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationId, date }),
      });
      const data = await res.json() as { jobId?: string };
      if (data.jobId) {
        window.open(`${API_BASE}/api/tax-export/download?job_id=${data.jobId}`, "_blank");
      }
    } catch (e) {
      console.error("Tax export failed:", e);
    } finally {
      setTaxExporting((prev) => ({ ...prev, [reservationId]: false }));
    }
  }
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });
  const normalizedSearch = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    return guests.filter((g) => {
      const matchSearch = g.guest_name.toLowerCase().includes(normalizedSearch);
      const matchStatus =
        statusFilter === "all" || g.check_in_status === statusFilter;
      const matchProperty =
        propertyFilter === "all" || g.property_id === propertyFilter;
      return matchSearch && matchStatus && matchProperty;
    });
  }, [guests, normalizedSearch, statusFilter, propertyFilter]);

  useEffect(() => {
    const maxPageIndex = Math.max(
      Math.ceil(filtered.length / pagination.pageSize) - 1,
      0
    );

    if (pagination.pageIndex > maxPageIndex) {
      setPagination((prev) => ({ ...prev, pageIndex: maxPageIndex }));
    }
  }, [filtered.length, pagination.pageIndex, pagination.pageSize]);

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
    meta: { rooms, properties, taxExporting, onTaxExport: handleTaxExport } satisfies ReservationsTableMeta,
  });

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <ReservationsHeader properties={properties} rooms={rooms} />
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
      <ReservationsHeader properties={properties} rooms={rooms} />
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
                  <span className="text-xs text-muted-foreground">Rows</span>
                  <NativeSelect
                    value={String(table.getState().pagination.pageSize)}
                    onChange={(event) => {
                      table.setPageSize(Number.parseInt(event.target.value, 10));
                    }}
                    className="h-8 w-20 text-xs"
                  >
                    <option value="15">15</option>
                    <option value="30">30</option>
                    <option value="50">50</option>
                  </NativeSelect>
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

import { type IngestSummaryResponse } from "@/hooks/use-pipeline-status";

const sourceAccounts = ["airbnb-main", "airbnb-ruby", "airbnb-manuka22"];

type ReservationFormState = {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  propertyId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adultCount: string;
  childCount: string;
  infantCount: string;
  notes: string;
};

const initialReservationForm: ReservationFormState = {
  guestName: "",
  guestPhone: "",
  guestEmail: "",
  propertyId: "",
  roomId: "",
  checkIn: "",
  checkOut: "",
  adultCount: "1",
  childCount: "0",
  infantCount: "0",
  notes: "",
};

function parseRepositoryError(error: unknown): { message: string; fields: Record<string, string> } {
  if (!(error instanceof Error)) return { message: "Reservation could not be created.", fields: {} };
  try {
    const parsed = JSON.parse(error.message) as { error?: string; errors?: Array<{ field: string; message: string }> };
    return {
      message: parsed.error ?? "Reservation could not be created.",
      fields: Object.fromEntries((parsed.errors ?? []).map((item) => [item.field, item.message])),
    };
  } catch {
    return { message: error.message, fields: {} };
  }
}

function SummaryPanel({ summary }: { summary: IngestSummaryResponse | null }) {
  if (!summary) return null;
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm mt-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <div><span className="text-muted-foreground">Processed</span><div className="font-semibold">{summary.processed}</div></div>
        <div><span className="text-muted-foreground">Created</span><div className="font-semibold">{summary.created}</div></div>
        <div><span className="text-muted-foreground">Updated</span><div className="font-semibold">{summary.updated}</div></div>
        <div><span className="text-muted-foreground">Skipped</span><div className="font-semibold">{summary.skipped}</div></div>
        <div><span className="text-muted-foreground">Dead letters</span><div className="font-semibold">{summary.deadLetters}</div></div>
        <div><span className="text-muted-foreground">Dry run</span><div className="font-semibold">{String(summary.dryRun)}</div></div>
      </div>
      {summary.errors.length > 0 && (
        <div className="mt-3 space-y-1 text-destructive">
          {summary.errors.map((error, index) => <div key={index}>{error.code}: {error.message}</div>)}
        </div>
      )}
    </div>
  );
}

async function submitCsv(formData: FormData): Promise<IngestSummaryResponse> {
  const response = await fetch("/api/ingest/reservations", { method: "POST", body: formData });
  return response.json() as Promise<IngestSummaryResponse>;
}

function ReservationsHeader({ properties, rooms }: { properties: Property[], rooms: Room[] }) {
  const queryClient = useQueryClient();
  const repositories = useMemo(() => createRestRepositories(), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reservationForm, setReservationForm] = useState<ReservationFormState>(initialReservationForm);
  const [uploadSummary, setUploadSummary] = useState<IngestSummaryResponse | null>(null);
  const [uploadSourceAccount, setUploadSourceAccount] = useState("airbnb-main");
  const [uploadDryRun, setUploadDryRun] = useState(true);

  const reservationMutation = useMutation({
    mutationFn: (input: ReservationCreateInput) => repositories.reservations.create(input),
    onSuccess: () => {
      setReservationForm(initialReservationForm);
      setDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.reservations });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });

  const selectedRooms = reservationForm.propertyId
    ? rooms.filter((room) => room.property_id === reservationForm.propertyId)
    : rooms;
  const adultCount = Number.parseInt(reservationForm.adultCount || "1", 10);
  const childCount = Number.parseInt(reservationForm.childCount || "0", 10);
  const infantCount = Number.parseInt(reservationForm.infantCount || "0", 10);
  const canSubmitReservation = Boolean(
    reservationForm.guestName.trim() &&
      reservationForm.propertyId &&
      reservationForm.checkIn &&
      reservationForm.checkOut &&
      !reservationMutation.isPending
  );
  const reservationError = parseRepositoryError(reservationMutation.error);

  const setFormField = (key: keyof ReservationFormState, value: string) => {
    reservationMutation.reset();
    setReservationForm((current) => ({ ...current, [key]: value }));
  };

  const onManualCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const totalGuests = adultCount + childCount + infantCount;
    reservationMutation.mutate({
      property_id: reservationForm.propertyId,
      primary_room_id: reservationForm.roomId || null,
      check_in_date: reservationForm.checkIn,
      check_out_date: reservationForm.checkOut,
      guest_name: reservationForm.guestName.trim(),
      guest_phone: reservationForm.guestPhone.trim() || null,
      guest_email: reservationForm.guestEmail.trim() || null,
      adult_count: adultCount,
      child_count: childCount,
      infant_count: infantCount,
      guest_count: Math.max(totalGuests, adultCount),
      operational_notes: "booking_source=Manual",
      guest_notes: reservationForm.notes.trim(),
    });
  };

  const onUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("dryRun", String(uploadDryRun));
    formData.set("sourceAccount", uploadSourceAccount);
    const summary = await submitCsv(formData);
    setUploadSummary(summary);
  };

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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 gap-1.5 text-xs bg-harbor text-harbor-foreground hover:bg-harbor-deep">
              <Plus className="h-3.5 w-3.5" />
              New Reservation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] border-none bg-background/80 backdrop-blur-xl shadow-2xl ring-1 ring-white/10 dark:ring-white/5">
            <DialogHeader>
              <DialogTitle>New Reservation</DialogTitle>
              <DialogDescription>
                Manually create a reservation or upload a provider CSV.
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="manual" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                <TabsTrigger value="csv">CSV Upload</TabsTrigger>
              </TabsList>
              <TabsContent value="manual" className="space-y-4 pt-4">
                <form className="space-y-4" onSubmit={onManualCreate}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Guest Name</Label>
                    <Input value={reservationForm.guestName} onChange={(event) => setFormField("guestName", event.target.value)} placeholder="John Doe" />
                    {reservationError.fields.guest_name && <p className="text-xs text-destructive">{reservationError.fields.guest_name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={reservationForm.guestPhone} onChange={(event) => setFormField("guestPhone", event.target.value)} placeholder="+1 234 567 8900" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={reservationForm.guestEmail} onChange={(event) => setFormField("guestEmail", event.target.value)} type="email" placeholder="john@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Property</Label>
                    <NativeSelect value={reservationForm.propertyId} onChange={(event) => setFormField("propertyId", event.target.value)}>
                      <option value="">Select Property</option>
                      {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </NativeSelect>
                    {reservationError.fields.property_id && <p className="text-xs text-destructive">{reservationError.fields.property_id}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Room</Label>
                    <NativeSelect value={reservationForm.roomId} onChange={(event) => setFormField("roomId", event.target.value)}>
                      <option value="">Select Room</option>
                      {selectedRooms.map(r => <option key={r.id} value={r.id}>{r.room_number} - {r.room_type}</option>)}
                    </NativeSelect>
                    {reservationError.fields.primary_room_id && <p className="text-xs text-destructive">{reservationError.fields.primary_room_id}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Check In</Label>
                    <Input value={reservationForm.checkIn} onChange={(event) => setFormField("checkIn", event.target.value)} type="date" />
                    {reservationError.fields.check_in_date && <p className="text-xs text-destructive">{reservationError.fields.check_in_date}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Check Out</Label>
                    <Input value={reservationForm.checkOut} onChange={(event) => setFormField("checkOut", event.target.value)} type="date" />
                    {reservationError.fields.check_out_date && <p className="text-xs text-destructive">{reservationError.fields.check_out_date}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Guests</Label>
                    <div className="flex gap-2">
                      <Input value={reservationForm.adultCount} onChange={(event) => setFormField("adultCount", event.target.value)} type="number" placeholder="Adults" className="w-full" min="1" />
                      <Input value={reservationForm.childCount} onChange={(event) => setFormField("childCount", event.target.value)} type="number" placeholder="Child" className="w-full" min="0" />
                      <Input value={reservationForm.infantCount} onChange={(event) => setFormField("infantCount", event.target.value)} type="number" placeholder="Infant" className="w-full" min="0" />
                    </div>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Notes</Label>
                    <Input value={reservationForm.notes} onChange={(event) => setFormField("notes", event.target.value)} placeholder="Special requests..." />
                  </div>
                </div>
                {reservationMutation.isError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {reservationError.message}
                  </div>
                )}
                <Button className="w-full" disabled={!canSubmitReservation} type="submit">
                  {reservationMutation.isPending ? "Creating..." : "Create Reservation"}
                </Button>
                </form>
              </TabsContent>
              <TabsContent value="csv" className="space-y-4 pt-4">
                <form className="space-y-4" onSubmit={onUpload}>
                  <div className="space-y-2">
                    <Label>Source Account</Label>
                    <NativeSelect value={uploadSourceAccount} onChange={(e) => setUploadSourceAccount(e.target.value)}>
                      {sourceAccounts.map((a) => <option key={a} value={a}>{a}</option>)}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <Label>CSV File</Label>
                    <Input name="file" type="file" accept=".csv" required />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Switch checked={uploadDryRun} onCheckedChange={setUploadDryRun} />
                    <span className="text-sm">Dry run</span>
                  </div>
                  <Button type="submit" className="w-full">Upload CSV</Button>
                </form>
                <SummaryPanel summary={uploadSummary} />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
