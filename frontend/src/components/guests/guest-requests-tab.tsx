import { useMemo, useState } from "react";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type PaginationState, type SortingState } from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCreateGuestRequest, useGuestRequests, useTransitionGuestRequest } from "@/hooks/use-guests-tenants-data";
import { formatVietnamDate } from "@/lib/vietnam-time";
import type { GuestRequest, GuestRequestPriority, GuestRequestStatus } from "@/types/database";

type GuestRequestsTabProps = {
  propertyId: string;
  reservationId?: string;
  guestId?: string;
  roomId?: string;
};

type SortKey = "priority" | "status" | "created_at" | "updated_at";

const priorityOrder: Record<GuestRequestPriority, number> = { low: 0, medium: 1, high: 2, urgent: 3 };
const statusOrder: Record<GuestRequestStatus, number> = { open: 0, reopened: 1, assigned: 2, in_progress: 3, fulfilled: 4, closed: 5 };

function badgeClassForStatus(status: GuestRequestStatus) {
  switch (status) {
    case "open":
    case "reopened":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300";
    case "assigned":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
    case "in_progress":
      return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300";
    case "fulfilled":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
    case "closed":
      return "border-border bg-muted text-muted-foreground";
  }
}

function badgeClassForPriority(priority: GuestRequestPriority) {
  switch (priority) {
    case "low": return "border-border bg-muted text-muted-foreground";
    case "medium": return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
    case "high": return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300";
    case "urgent": return "border-red-300 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200";
  }
}

function legalTransitions(status: GuestRequestStatus): Array<{ label: string; status: GuestRequestStatus }> {
  switch (status) {
    case "open":
    case "reopened":
      return [{ label: "Assign", status: "assigned" }];
    case "assigned":
      return [{ label: "Start", status: "in_progress" }];
    case "in_progress":
      return [{ label: "Fulfill", status: "fulfilled" }];
    case "fulfilled":
      return [{ label: "Close", status: "closed" }];
    case "closed":
      return [{ label: "Reopen", status: "reopened" }];
  }
}

function sortRequests(requests: GuestRequest[], sortKey: SortKey) {
  return [...requests].sort((a, b) => {
    if (sortKey === "priority") return priorityOrder[b.priority ?? "low"] - priorityOrder[a.priority ?? "low"];
    if (sortKey === "status") return statusOrder[a.status ?? "open"] - statusOrder[b.status ?? "open"];
    return String(b[sortKey] ?? "").localeCompare(String(a[sortKey] ?? ""));
  });
}

function matchesSearch(request: GuestRequest, search: string) {
  const value = search.trim().toLowerCase();
  if (!value) return true;
  return [request.description, request.request_type, request.notes].filter(Boolean).join(" ").toLowerCase().includes(value);
}

export function GuestRequestsTab({ propertyId, reservationId, guestId, roomId }: GuestRequestsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<GuestRequestStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<GuestRequestPriority | "all">("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState<GuestRequestPriority>("medium");
  const [reservationIdInput, setReservationIdInput] = useState(reservationId ?? "");
  const [guestIdInput, setGuestIdInput] = useState(guestId ?? "");
  const [roomIdInput, setRoomIdInput] = useState(roomId ?? "");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTargetId, setAssignTargetId] = useState<string | null>(null);
  const [assignValue, setAssignValue] = useState("");

  const { data = [], isLoading } = useGuestRequests(propertyId, {
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
  });
  const createGuestRequest = useCreateGuestRequest();
  const transitionGuestRequest = useTransitionGuestRequest();

  const requests = useMemo(() => sortRequests(data, sortKey), [data, sortKey]);
  const filteredRequests = useMemo(() => requests.filter((request) => matchesSearch(request, search)), [requests, search]);

  const columns = useMemo<ColumnDef<GuestRequest>[]>(() => [
    { accessorKey: "description", header: "Description", cell: ({ row }) => <div className="max-w-[20rem] truncate text-sm">{row.original.description ?? row.original.notes}</div> },
    { accessorKey: "priority", header: "Priority", cell: ({ row }) => <Badge variant="outline" className={`capitalize ${badgeClassForPriority(row.original.priority ?? "low")}`}>{row.original.priority ?? "low"}</Badge> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant="outline" className={`capitalize ${badgeClassForStatus(row.original.status ?? "open")}`}>{row.original.status ?? "open"}</Badge> },
    { accessorKey: "assigned_to", header: "Assigned To", cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.assigned_to ?? "—"}</span> },
    { accessorKey: "created_at", header: "Created At", cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatVietnamDate(row.original.created_at)}</span> },
    { accessorKey: "updated_at", header: "Updated At", cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.updated_at ? formatVietnamDate(row.original.updated_at) : "—"}</span> },
    { id: "actions", header: "", cell: ({ row }) => {
      const next = legalTransitions(row.original.status ?? "open");
      if (!next.length) return null;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2">Actions</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {next.map((item) => (
              <DropdownMenuItem
                key={item.status}
                onClick={() => {
                  if (item.status === "assigned") {
                    const nextAssignee = row.original.assigned_to ?? assignValue.trim();
                    if (!nextAssignee) {
                      setAssignTargetId(row.original.id);
                      setAssignDialogOpen(true);
                      return;
                    }
                    transitionGuestRequest.mutate({ id: row.original.id, status: "assigned", assigned_to: nextAssignee });
                    return;
                  }

                  transitionGuestRequest.mutate({
                    id: row.original.id,
                    status: item.status,
                    assigned_to: row.original.assigned_to ?? null,
                  });
                }}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }},
  ], [assignValue, transitionGuestRequest]);

  const table = useReactTable({
    data: filteredRequests,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  async function onSubmit() {
    await createGuestRequest.mutateAsync({
      reservation_id: reservationIdInput,
      guest_id: guestIdInput.trim() ? guestIdInput : null,
      room_id: roomIdInput.trim() ? roomIdInput : null,
      property_id: propertyId,
      request_type: description,
      notes: description,
      description,
      assigned_to: assignedTo || null,
      priority,
      status: "open",
      is_completed: false,
    });
    setDialogOpen(false);
    setDescription("");
    setAssignedTo("");
    if (!reservationId) setReservationIdInput("");
    if (!guestId) setGuestIdInput("");
    if (!roomId) setRoomIdInput("");
  }

  return <div className="space-y-4">
    <Card>
      <CardHeader className="pb-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-sm font-semibold">Guest Requests</CardTitle><p className="text-xs text-muted-foreground">Manage service requests and lifecycle actions</p></div><Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New Request</Button></div></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} placeholder="Request search" className="h-8 w-44 pl-8 text-xs" onChange={(e) => { setSearch(e.target.value); table.setPageIndex(0); }} /></div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as GuestRequestStatus | "all"); table.setPageIndex(0); }}><SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="assigned">Assigned</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="fulfilled">Fulfilled</SelectItem><SelectItem value="closed">Closed</SelectItem><SelectItem value="reopened">Reopened</SelectItem></SelectContent></Select>
            <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v as GuestRequestPriority | "all"); table.setPageIndex(0); }}><SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger><SelectContent><SelectItem value="all">All Priorities</SelectItem><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select>
          </div>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}><SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Sort by" /></SelectTrigger><SelectContent><SelectItem value="priority">Priority</SelectItem><SelectItem value="status">Status</SelectItem><SelectItem value="created_at">Created At</SelectItem><SelectItem value="updated_at">Updated At</SelectItem></SelectContent></Select>
        </div>
        <Separator />
        <Table>
          <TableHeader>{table.getHeaderGroups().map((hg) => <TableRow key={hg.id}>{hg.headers.map((h) => <TableHead key={h.id} className={h.column.getCanSort() ? "cursor-pointer select-none" : ""} onClick={h.column.getToggleSortingHandler()}>{h.isPlaceholder ? null : <span className="inline-flex items-center gap-1">{flexRender(h.column.columnDef.header, h.getContext())}{h.column.getCanSort() ? <ArrowUpDown className="h-3 w-3" /> : null}</span>}</TableHead>)}</TableRow>)}</TableHeader>
          <TableBody>{isLoading ? <TableRow><TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow> : table.getRowModel().rows.length === 0 ? <TableRow><TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">No guest requests. Create the first one above.</TableCell></TableRow> : table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody>
        </Table>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><p>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" className="h-8 gap-1 text-xs" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><ChevronLeft className="h-3.5 w-3.5" /> Prev</Button><Button variant="outline" size="sm" className="h-8 gap-1 text-xs" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Next <ChevronRight className="h-3.5 w-3.5" /></Button></div></div>
      </CardContent>
    </Card>
    <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}><DialogContent><DialogHeader><DialogTitle>Assign request</DialogTitle><DialogDescription>Enter an assignee before moving to Assigned.</DialogDescription></DialogHeader><div className="grid gap-2 py-2"><Label htmlFor="assign-to">Assigned To</Label><Input id="assign-to" value={assignValue} onChange={(e) => setAssignValue(e.target.value)} placeholder="Staff name / ID" /></div><DialogFooter><Button variant="outline" onClick={() => { setAssignDialogOpen(false); setAssignTargetId(null); }}>Cancel</Button><Button disabled={!assignValue.trim() || !assignTargetId} onClick={() => { if (!assignTargetId) return; transitionGuestRequest.mutate({ id: assignTargetId, status: "assigned", assigned_to: assignValue.trim() }); setAssignDialogOpen(false); setAssignTargetId(null); setAssignValue(""); }}>Assign</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>New Request</DialogTitle><DialogDescription>Create a reservation-linked request for this property.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label htmlFor="reservation-id">Reservation ID</Label><Input id="reservation-id" value={reservationIdInput} onChange={(e) => setReservationIdInput(e.target.value)} placeholder="reservation-..." /></div><div className="grid gap-2"><Label htmlFor="guest-id">Guest ID</Label><Input id="guest-id" value={guestIdInput} onChange={(e) => setGuestIdInput(e.target.value)} placeholder="guest-..." /></div><div className="grid gap-2"><Label htmlFor="room-id">Room ID</Label><Input id="room-id" value={roomIdInput} onChange={(e) => setRoomIdInput(e.target.value)} placeholder="room-..." /></div><div className="grid gap-2"><Label htmlFor="description">Description</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the request" /></div><div className="grid gap-2 sm:grid-cols-2"><div className="grid gap-2"><Label>Priority</Label><Select value={priority} onValueChange={(v) => setPriority(v as GuestRequestPriority)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="assigned-to">Assigned To</Label><Input id="assigned-to" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Staff name / ID" /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => void onSubmit()} disabled={createGuestRequest.isPending || !description.trim() || !reservationIdInput.trim()}>{createGuestRequest.isPending ? "Saving…" : "Create Request"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
