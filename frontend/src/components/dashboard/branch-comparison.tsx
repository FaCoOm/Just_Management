import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { PropertyMetrics } from "@/types/database";

interface BranchComparisonProps {
  metrics: PropertyMetrics[];
}

export function BranchComparison({ metrics }: BranchComparisonProps) {
  const sorted = [...metrics].sort(
    (a, b) => b.occupancyRate - a.occupancyRate
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-[-0.005em]">
          Portfolio Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6 text-xs font-medium">
                  Property
                </TableHead>
                <TableHead className="text-center text-xs font-medium">
                  Arrivals
                </TableHead>
                <TableHead className="text-center text-xs font-medium">
                  Departures
                </TableHead>
                <TableHead className="text-xs font-medium min-w-[140px]">
                  Occupancy
                </TableHead>
                <TableHead className="pr-6 text-center text-xs font-medium">
                  Maintenance
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((m) => (
                <TableRow key={m.property.id}>
                  <TableCell className="pl-6">
                    <div>
                      <p className="text-sm font-medium">
                        {m.property.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {m.property.location}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-semibold">{m.arrivals}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-semibold">
                      {m.departures}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={m.occupancyRate}
                        className="h-2 flex-1 bg-harbor/20 [&>[data-slot=progress-indicator]]:bg-harbor"
                      />
                      <span className="text-xs font-medium w-8 text-right">
                        {m.occupancyRate}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 text-center">
                    {m.maintenanceOpen > 0 ? (
                      <Badge
                        variant="outline"
                        className={
                          m.maintenanceOpen >= 3
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }
                      >
                        {m.maintenanceOpen} open
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        Clear
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
