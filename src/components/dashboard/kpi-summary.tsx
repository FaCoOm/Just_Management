import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LogIn,
  LogOut,
  BedDouble,
  Wrench,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface KpiSummaryProps {
  totals: {
    arrivals: number;
    departures: number;
    occupancyRate: number;
    maintenanceOpen: number;
  };
}

export function KpiSummary({ totals }: KpiSummaryProps) {
  const cards = [
    {
      title: "Arrivals Today",
      value: totals.arrivals,
      delta: "+3.2%",
      deltaUp: true,
      icon: LogIn,
      iconBg: "bg-chart-1/10 text-chart-1",
    },
    {
      title: "Departures Today",
      value: totals.departures,
      delta: "+1.8%",
      deltaUp: true,
      icon: LogOut,
      iconBg: "bg-chart-2/10 text-chart-2",
    },
    {
      title: "Occupancy Rate",
      value: `${totals.occupancyRate}%`,
      delta: "+5.1%",
      deltaUp: true,
      icon: BedDouble,
      iconBg: "bg-chart-4/10 text-chart-4",
    },
    {
      title: "Maintenance Open",
      value: totals.maintenanceOpen,
      delta: "-2",
      deltaUp: false,
      icon: Wrench,
      iconBg: "bg-chart-3/10 text-chart-3",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="gap-3 py-4">
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`rounded-md p-1.5 ${card.iconBg}`}>
              <card.icon className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">
                {card.value}
              </span>
              <span
                className={`flex items-center gap-0.5 text-xs font-medium ${
                  card.deltaUp ? "text-emerald-600" : "text-emerald-600"
                }`}
              >
                {card.deltaUp ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {card.delta}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
