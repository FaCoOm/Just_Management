import { useMemo, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Activity, Key, AlertCircle, Search, Clock, Globe, UserCog } from "lucide-react";

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  resource: string;
  details: string;
  severity: "info" | "warning" | "critical";
}

const severityConfig: Record<string, { label: string; className: string; icon: typeof Activity }> = {
  info: { label: "Info", className: "bg-chart-1/10 text-chart-1 border-chart-1/20", icon: Activity },
  warning: { label: "Warning", className: "bg-chart-4/10 text-chart-4 border-chart-4/20", icon: AlertCircle },
  critical: { label: "Critical", className: "bg-destructive/10 text-destructive border-destructive/20", icon: ShieldCheck },
};


function generateAuditEntries(): AuditEntry[] {
  const actions = [
    { action: "User Login", actor: "Robert Austin", resource: "auth", details: "Login from 10.0.0.1", severity: "info" as const },
    { action: "Export Job Run", actor: "System", resource: "tax-export", details: "Same-day checkout export completed: 5 items", severity: "info" as const },
    { action: "Connection Refresh", actor: "System", resource: "withone-gmail", details: "Gmail token refreshed", severity: "info" as const },
    { action: "Rate Override", actor: "Linh Tran", resource: "rates", details: "Deluxe King weekend rate updated to 2,160,000 VND", severity: "info" as const },
    { action: "Failed Login Attempt", actor: "unknown@test.com", resource: "auth", details: "3 failed attempts from IP 192.168.1.50", severity: "warning" as const },
    { action: "Permission Change", actor: "Robert Austin", resource: "staff", details: "Mai Nguyen role changed to manager", severity: "warning" as const },
    { action: "Sync Failure", actor: "System", resource: "booking-com", details: "API timeout on reservation sync", severity: "critical" as const },
    { action: "Sheet Write Error", actor: "System", resource: "google-sheets", details: "Quota exceeded, retry scheduled", severity: "warning" as const },
    { action: "Webhook Received", actor: "Airbnb", resource: "webhooks", details: "Reservation update webhook processed", severity: "info" as const },
    { action: "Staff Deactivated", actor: "Robert Austin", resource: "staff", details: "Carlos Rodriguez account deactivated", severity: "warning" as const },
  ];
  return actions.map((a, i) => ({
    id: `audit-${i}`,
    timestamp: new Date(Date.now() - i * 1800000).toISOString(),
    ...a,
  }));
}

export function SecurityAccessPage() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");

  const entries = useMemo(() => generateAuditEntries(), []);
  const filtered = useMemo(() => entries.filter((e) => {
    const matchSearch = e.action.toLowerCase().includes(search.toLowerCase()) || e.actor.toLowerCase().includes(search.toLowerCase()) || e.details.toLowerCase().includes(search.toLowerCase());
    const matchSeverity = severityFilter === "all" || e.severity === severityFilter;
    return matchSearch && matchSeverity;
  }), [entries, search, severityFilter]);

  const infoCount = entries.filter((e) => e.severity === "info").length;
  const warningCount = entries.filter((e) => e.severity === "warning").length;
  const criticalCount = entries.filter((e) => e.severity === "critical").length;

  return (
    <div className="flex h-full max-h-svh flex-col" data-testid="security-access-page">
      <SecurityHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Events</CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1"><Activity className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="total-events">{entries.length}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Warnings</CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4"><AlertCircle className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="warning-count">{warningCount}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Critical</CardTitle>
                <div className="rounded-md bg-destructive/10 p-1.5 text-destructive"><ShieldCheck className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="critical-count">{criticalCount}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Info Events</CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"><Key className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="info-count">{infoCount}</span></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-sm font-semibold">Audit Log</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-44 pl-8 text-xs" data-testid="search-events" />
                  </div>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severity</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {filtered.map((entry) => {
                const config = severityConfig[entry.severity];
                const Icon = config.icon;
                const time = new Date(entry.timestamp);
                const timeStr = time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                const dateStr = time.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
                return (
                  <div key={entry.id} className="flex items-start gap-3 rounded-lg border border-border px-4 py-3 hover:bg-muted/40 transition-colors" data-testid={`audit-entry-${entry.id}`}>
                    <div className={`mt-0.5 rounded-md p-1.5 ${config.className.split(" ").slice(0, 1).join(" ")}`}>
                      <Icon className={`h-3.5 w-3.5 ${config.className.split(" ").slice(1, 2).join(" ")}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium">{entry.action}</p>
                        <Badge variant="outline" className={`text-[9px] ${config.className}`}>{config.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><UserCog className="h-2.5 w-2.5" />{entry.actor}</span>
                        <span className="flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{entry.resource}</span>
                        <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{dateStr} {timeStr}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="py-8 text-center">
                  <ShieldCheck className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No audit entries match your filters</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SecurityHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Security & Access</h2>
          <p className="text-xs text-muted-foreground">Audit log, integrations status, and access events</p>
        </div>
      </div>
    </header>
  );
}
