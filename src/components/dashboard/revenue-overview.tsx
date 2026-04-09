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
import { Bar, BarChart, XAxis, YAxis } from "recharts";

const chartConfig = {
  room: { label: "Room", color: "var(--chart-1)" },
  platform: { label: "Platform", color: "var(--chart-2)" },
  upsell: { label: "Upsell", color: "var(--chart-4)" },
} satisfies ChartConfig;

const channelData = [
  { channel: "Booking.com", room: 4200, platform: 1800, upsell: 600 },
  { channel: "Airbnb", room: 3800, platform: 1500, upsell: 450 },
  { channel: "Agoda", room: 3200, platform: 1200, upsell: 380 },
  { channel: "Hotels.com", room: 2800, platform: 900, upsell: 300 },
  { channel: "Expedia", room: 2400, platform: 800, upsell: 250 },
  { channel: "Direct", room: 3600, platform: 0, upsell: 520 },
];

export function RevenueOverview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Revenue Overview</CardTitle>
        <CardAction>
          <Select defaultValue="all">
            <SelectTrigger className="h-8 w-[80px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="room">Room</SelectItem>
              <SelectItem value="platform">Platform</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart
            accessibilityLayer
            data={channelData}
            layout="vertical"
            margin={{ top: 0, right: 4, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              dataKey="channel"
              type="category"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={80}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="room"
              fill="var(--color-room)"
              stackId="a"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="platform"
              fill="var(--color-platform)"
              stackId="a"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="upsell"
              fill="var(--color-upsell)"
              stackId="a"
              radius={[0, 2, 2, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
