import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { PropertyMetrics } from "@/types/database";

interface OccupancyDetailProps {
  metrics: PropertyMetrics[];
}

export function OccupancyDetail({ metrics }: OccupancyDetailProps) {
  const sorted = [...metrics].sort(
    (a, b) => b.occupancyRate - a.occupancyRate
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">
          Occupancy by Property
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.map((m) => (
          <div key={m.property.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{m.property.name}</span>
              <span className="text-xs text-muted-foreground">
                {m.occupiedRooms}/{m.property.total_rooms} rooms &middot;{" "}
                {m.occupancyRate}%
              </span>
            </div>
            <Progress
              value={m.occupancyRate}
              className="h-2 bg-harbor/20 [&>[data-slot=progress-indicator]]:bg-harbor"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
