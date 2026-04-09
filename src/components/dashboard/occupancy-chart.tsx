import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const chartConfig = {
  occupied: { label: "Occupied", color: "var(--chart-2)" },
  available: { label: "Available", color: "var(--chart-3)" },
  notReady: { label: "Not Ready", color: "var(--chart-5)" },
} satisfies ChartConfig;

const chartData = Array.from({ length: 30 }, (_, i) => {
  const day = String(i + 1).padStart(2, "0");
  const occupied = Math.floor(60 + Math.random() * 80);
  const available = Math.floor(20 + Math.random() * 40);
  const notReady = Math.floor(-10 + Math.random() * 30);
  return { day, occupied, available, notReady };
});

export function OccupancyChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Occupancy</CardTitle>
        <CardAction>
          <Select defaultValue="all">
            <SelectTrigger className="h-8 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="latte-lounge">Latte Lounge</SelectItem>
              <SelectItem value="the-opera">The Opera</SelectItem>
              <SelectItem value="cochinchine">Cochinchine</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: -12 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              interval={2}
            />
            <YAxis tickLine={false} axisLine={false} fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="occupied"
              fill="var(--color-occupied)"
              radius={[2, 2, 0, 0]}
              stackId="a"
            />
            <Bar
              dataKey="available"
              fill="var(--color-available)"
              radius={[2, 2, 0, 0]}
              stackId="a"
            />
            <Bar
              dataKey="notReady"
              fill="var(--color-notReady)"
              radius={[2, 2, 0, 0]}
              stackId="a"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
