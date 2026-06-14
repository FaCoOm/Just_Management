import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MaintenanceIssue, Property } from "@/types/database";
import { TriangleAlert as AlertTriangle, Clock, CircleCheck as CheckCircle } from "lucide-react";

interface MaintenanceDetailProps {
  maintenance: MaintenanceIssue[];
  properties: Property[];
}

const severityConfig: Record<string, { className: string }> = {
  Critical: { className: "border-destructive/30 bg-destructive/10 text-destructive" },
  High: { className: "border-amber-300 bg-amber-50 text-amber-700" },
  Medium: { className: "border-chart-4/30 bg-chart-4/10 text-chart-4" },
  Low: { className: "border-border bg-secondary text-muted-foreground" },
};

const statusIcons: Record<string, typeof AlertTriangle> = {
  Open: AlertTriangle,
  "In Progress": Clock,
  Resolved: CheckCircle,
};

export function MaintenanceDetail({ maintenance, properties }: MaintenanceDetailProps) {
  const open = maintenance.filter((m) => m.status !== "Resolved");

  const grouped = properties
    .map((p) => ({
      property: p,
      issues: open.filter((m) => m.property_id === p.id),
    }))
    .filter((g) => g.issues.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Maintenance Queue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {grouped.map(({ property, issues }) => (
          <div key={property.id} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {property.name}
            </p>
            <div className="space-y-1.5">
              {issues.map((issue) => {
                const StatusIcon = statusIcons[issue.status] ?? AlertTriangle;
                const sevConfig = severityConfig[issue.severity] ?? severityConfig.Low;

                return (
                  <div
                    key={issue.id}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <StatusIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {issue.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {issue.description}
                      </p>
                    </div>
                    <Badge variant="outline" className={sevConfig.className}>
                      {issue.severity}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No open maintenance issues
          </p>
        )}
      </CardContent>
    </Card>
  );
}
