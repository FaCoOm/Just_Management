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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, Plus, Search, TriangleAlert, Clock, CircleCheck, ListFilter as Filter } from "lucide-react";
import type { Severity, MaintenanceStatus } from "@/types/database";

const severityConfig: Record<
  Severity,
  { className: string; order: number }
> = {
  Critical: {
    className:
      "border-destructive/30 bg-destructive/10 text-destructive",
    order: 0,
  },
  High: {
    className:
      "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
    order: 1,
  },
  Medium: {
    className: "border-chart-4/30 bg-chart-4/10 text-chart-4",
    order: 2,
  },
  Low: {
    className: "border-border bg-secondary text-muted-foreground",
    order: 3,
  },
};

const statusConfig: Record<
  MaintenanceStatus,
  { icon: typeof Wrench; className: string }
> = {
  Open: {
    icon: TriangleAlert,
    className: "text-destructive",
  },
  "In Progress": {
    icon: Clock,
    className: "text-chart-4",
  },
  Resolved: {
    icon: CircleCheck,
    className: "text-emerald-600 dark:text-emerald-400",
  },
};

function MaintenanceSkeleton() {
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

export function MaintenancePage() {
  const { maintenance, properties, rooms, loading } = useDashboardData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <MaintenanceHeader />
        <MaintenanceSkeleton />
      </div>
    );
  }

  const filtered = maintenance
    .filter((m) => {
      const matchSearch =
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        m.description.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || m.status === statusFilter;
      const matchSeverity =
        severityFilter === "all" || m.severity === severityFilter;
      const matchProperty =
        propertyFilter === "all" || m.property_id === propertyFilter;
      return matchSearch && matchStatus && matchSeverity && matchProperty;
    })
    .sort(
      (a, b) =>
        (severityConfig[a.severity]?.order ?? 99) -
        (severityConfig[b.severity]?.order ?? 99)
    );

  const openCount = maintenance.filter((m) => m.status === "Open").length;
  const inProgressCount = maintenance.filter(
    (m) => m.status === "In Progress"
  ).length;
  const resolvedCount = maintenance.filter(
    (m) => m.status === "Resolved"
  ).length;
  const criticalCount = maintenance.filter(
    (m) => m.severity === "Critical" && m.status !== "Resolved"
  ).length;

  return (
    <div className="flex h-full max-h-svh flex-col">
      <MaintenanceHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Open Issues
                </CardTitle>
                <div className="rounded-md bg-destructive/10 p-1.5 text-destructive">
                  <TriangleAlert className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight">
                  {openCount}
                </span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  In Progress
                </CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4">
                  <Clock className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight">
                  {inProgressCount}
                </span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Critical
                </CardTitle>
                <div className="rounded-md bg-destructive/10 p-1.5 text-destructive">
                  <TriangleAlert className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight">
                    {criticalCount}
                  </span>
                  {criticalCount > 0 && (
                    <span className="text-xs text-destructive font-medium">
                      urgent
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Resolved
                </CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <CircleCheck className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight">
                  {resolvedCount}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Main table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-sm font-semibold">
                  Maintenance Log
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search issues..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 w-44 pl-8 text-xs"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <Filter className="mr-1.5 h-3 w-3" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={severityFilter}
                    onValueChange={setSeverityFilter}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severity</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={propertyFilter}
                    onValueChange={setPropertyFilter}
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
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-t border-border">
                    <TableHead className="pl-4 text-xs">Issue</TableHead>
                    <TableHead className="text-xs">Property</TableHead>
                    <TableHead className="text-xs">Room</TableHead>
                    <TableHead className="text-xs">Severity</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Reported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No issues found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((issue) => {
                      const property = properties.find(
                        (p) => p.id === issue.property_id
                      );
                      const room = rooms.find((r) => r.id === issue.room_id);
                      const sevConfig =
                        severityConfig[issue.severity] ??
                        severityConfig.Low;
                      const statConfig =
                        statusConfig[issue.status] ?? statusConfig.Open;
                      const StatusIcon = statConfig.icon;
                      const date = new Date(issue.created_at).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" }
                      );

                      return (
                        <TableRow
                          key={issue.id}
                          className="cursor-pointer hover:bg-muted/40"
                        >
                          <TableCell className="pl-4 py-2.5 max-w-[260px]">
                            <div className="flex items-start gap-2.5">
                              <StatusIcon
                                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${statConfig.className}`}
                              />
                              <div>
                                <p className="text-xs font-medium truncate">
                                  {issue.title}
                                </p>
                                <p className="text-[10px] text-muted-foreground line-clamp-1">
                                  {issue.description}
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
                              <span className="text-muted-foreground">
                                Common Area
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${sevConfig.className}`}
                            >
                              {issue.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {issue.status}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {date}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MaintenanceHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Maintenance Logs</h2>
          <p className="text-xs text-muted-foreground">
            Track and manage property maintenance issues
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs bg-harbor text-harbor-foreground hover:bg-harbor-deep"
        >
          <Plus className="h-3.5 w-3.5" />
          Log Issue
        </Button>
      </div>
    </header>
  );
}
