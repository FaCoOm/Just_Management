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
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/native-select";
import { useReservationsPageData } from "@/hooks/use-page-data";
import { formatVietnamDate } from "@/lib/vietnam-time";
import {
  FileText, DollarSign, Search, ChevronLeft, ChevronRight, CreditCard, Receipt,
} from "lucide-react";
import type { Reservation } from "@/types/database";

interface InvoiceRecord {
  id: string;
  reservationId: string;
  guestName: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "exported";
  source: string;
}

function BillingInvoicesSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-lg" />))}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

function generateInvoices(reservations: Reservation[]): InvoiceRecord[] {
  const rates: Record<string, number> = { pending: 1200000, check_in_pending: 1500000, checked_in: 1800000, check_out_pending: 2000000, checked_out: 1600000 };
  return reservations.map((r, i) => ({
    id: `inv-${i}`,
    reservationId: r.id,
    guestName: r.guest_name,
    propertyId: r.property_id,
    checkIn: r.check_in_date,
    checkOut: r.check_out_date,
    amount: rates[r.status] ?? 1200000,
    status: r.status === "checked_out" ? "paid" : r.status === "check_out_pending" ? "pending" : i % 8 === 0 ? "overdue" : "pending",
    source: r.operational_notes.match(/booking_source=([^;]+)/)?.[1] ?? "Direct",
  }));
}

const statusConfig: Record<string, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
  pending: { label: "Pending", className: "bg-chart-4/10 text-chart-4 border-chart-4/20" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive border-destructive/20" },
  exported: { label: "Exported", className: "bg-chart-1/10 text-chart-1 border-chart-1/20" },
};

function formatVND(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

export function BillingInvoicesPage() {
  const { reservations, properties, loading } = useReservationsPageData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 12 });
  const normalizedSearch = search.trim().toLowerCase();

  const invoices = useMemo(() => generateInvoices(reservations), [reservations]);
  const propertyNameById = useMemo(
    () => new Map(properties.map((property) => [property.id, property.name] as const)),
    [properties]
  );
  const filtered = useMemo(() => invoices.filter((inv) => {
    const matchSearch = inv.guestName.toLowerCase().includes(normalizedSearch);
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchProperty = propertyFilter === "all" || inv.propertyId === propertyFilter;
    return matchSearch && matchStatus && matchProperty;
  }), [invoices, normalizedSearch, statusFilter, propertyFilter]);

  useEffect(() => {
    const maxPageIndex = Math.max(
      Math.ceil(filtered.length / pagination.pageSize) - 1,
      0
    );

    if (pagination.pageIndex > maxPageIndex) {
      setPagination((prev) => ({ ...prev, pageIndex: maxPageIndex }));
    }
  }, [filtered.length, pagination.pageIndex, pagination.pageSize]);

  const columns = useMemo<ColumnDef<InvoiceRecord>[]>(() => [
    { id: "guest", accessorKey: "guestName", header: "Guest", cell: ({ row }) => <span className="text-xs font-medium">{row.original.guestName}</span> },
    { id: "property", accessorFn: (row) => propertyNameById.get(row.propertyId) ?? "", header: "Property", cell: ({ row }) => <span className="text-xs text-muted-foreground">{propertyNameById.get(row.original.propertyId) ?? "—"}</span> },
    { id: "dates", header: "Stay", cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatVietnamDate(row.original.checkIn)} – {formatVietnamDate(row.original.checkOut)}</span> },
    { id: "source", accessorKey: "source", header: "Source", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.source}</span> },
    { id: "amount", accessorKey: "amount", header: "Amount", cell: ({ row }) => <span className="text-xs font-semibold text-right tabular-nums">{formatVND(row.original.amount)} VND</span> },
    { id: "status", accessorKey: "status", header: "Status", cell: ({ row }) => {
      const config = statusConfig[row.original.status] ?? statusConfig.pending;
      return <Badge variant="outline" className={`text-[10px] ${config.className}`}>{config.label}</Badge>;
    }},
  ], [propertyNameById]);

  const table = useReactTable({
    data: filtered, columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const totalRevenue = filtered.reduce((sum, inv) => sum + inv.amount, 0);
  const paidCount = filtered.filter((inv) => inv.status === "paid").length;
  const overdueCount = filtered.filter((inv) => inv.status === "overdue").length;

  if (loading) {
    return (<div className="flex h-full flex-col"><BillingHeader /><BillingInvoicesSkeleton /></div>);
  }

  return (
    <div className="flex h-full max-h-svh flex-col" data-testid="billing-invoices-page">
      <BillingHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Invoices</CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1"><FileText className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="invoice-count">{filtered.length}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Revenue</CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4"><DollarSign className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-lg font-bold tracking-tight" data-testid="total-revenue">{formatVND(totalRevenue)}</span><span className="text-xs text-muted-foreground ml-1">VND</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Paid</CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"><CreditCard className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="paid-count">{paidCount}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Overdue</CardTitle>
                <div className="rounded-md bg-destructive/10 p-1.5 text-destructive"><Receipt className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="overdue-count">{overdueCount}</span></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-sm font-semibold">Billing Records</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search guest..." value={search} onChange={(e) => { setSearch(e.target.value); table.setPageIndex(0); }} className="h-8 w-44 pl-8 text-xs" data-testid="search-input" />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); table.setPageIndex(0); }}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="exported">Exported</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <TableRow><TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">No billing records found</TableCell></TableRow>
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
                <p className="text-xs text-muted-foreground">Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1} · {filtered.length} row(s)</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Rows</span>
                  <NativeSelect
                    value={String(table.getState().pagination.pageSize)}
                    onChange={(event) => {
                      table.setPageSize(Number.parseInt(event.target.value, 10));
                    }}
                    className="h-8 w-20 text-xs"
                  >
                    <option value="12">12</option>
                    <option value="24">24</option>
                    <option value="48">48</option>
                  </NativeSelect>
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

function BillingHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Billing & Invoices</h2>
          <p className="text-xs text-muted-foreground">Operational billing records and payment status</p>
        </div>
      </div>
    </header>
  );
}
