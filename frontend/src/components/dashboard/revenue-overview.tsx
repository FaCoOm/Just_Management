import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function RevenueOverview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Revenue Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant="outline" className="w-fit">
          Awaiting revenue source
        </Badge>
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
          <p className="text-sm font-medium">Revenue data not connected yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Track B schema does not currently expose nightly rates, folios, or
            payout totals from Azure PostgreSQL. Fake revenue bars removed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
