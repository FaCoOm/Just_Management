import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  addDaysToVietnamDate,
  formatVietnamDate,
} from "@/lib/vietnam-time";
import { cn } from "@/lib/utils";
import type { OccupancySeriesPoint } from "@/types/database";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const chartConfig = {
  occupied: { label: "Occupied", color: "var(--chart-2)" },
  available: { label: "Available", color: "var(--chart-3)" },
} satisfies ChartConfig;

interface OccupancyChartProps {
  data: OccupancySeriesPoint[];
  today: string;
}

export function OccupancyChart({ data, today }: OccupancyChartProps) {
  const [rangeDays, setRangeDays] = useState(7);
  const [windowStartDate, setWindowStartDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => {
    setWindowStartDate(today);
    setSelectedDate(today);
  }, [today]);

  useEffect(() => {
    const windowDates = Array.from({ length: rangeDays }, (_, index) =>
      addDaysToVietnamDate(windowStartDate, index)
    );

    if (!windowDates.includes(selectedDate)) {
      setSelectedDate(windowStartDate);
    }
  }, [rangeDays, selectedDate, windowStartDate]);

  const pointsByDate = useMemo(
    () => new Map(data.map((point) => [point.date, point])),
    [data]
  );

  const calendarDays = useMemo(
    () =>
      Array.from({ length: rangeDays }, (_, index) => {
        const date = addDaysToVietnamDate(windowStartDate, index);
        const point = pointsByDate.get(date);
        const occupancyRate =
          point && point.totalRooms > 0
            ? Math.round((point.occupied / point.totalRooms) * 100)
            : 0;

        return {
          date,
          weekday: formatVietnamDate(date, { weekday: "short" }),
          day: formatVietnamDate(date, { day: "2-digit" }),
          month: formatVietnamDate(date, { month: "short" }),
          occupied: point?.occupied ?? 0,
          available: point?.available ?? 0,
          occupancyRate,
          totalRooms: point?.totalRooms ?? 0,
        };
      }),
    [pointsByDate, rangeDays, windowStartDate]
  );

  const chartData = calendarDays.map((day) => ({
    label:
      rangeDays > 14
        ? `${day.day}/${formatVietnamDate(day.date, { month: "2-digit" })}`
        : `${day.weekday} ${day.day}`,
    occupied: day.occupied,
    available: day.available,
  }));

  const selectedDay =
    calendarDays.find((day) => day.date === selectedDate) ?? calendarDays[0];

  function shiftWindow(direction: -1 | 1) {
    const nextStart = addDaysToVietnamDate(windowStartDate, direction * 7);
    setWindowStartDate(nextStart);
    setSelectedDate(nextStart);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Occupancy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => shiftWindow(-1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              1 week
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => shiftWindow(1)}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => {
                setWindowStartDate(today);
                setSelectedDate(today);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Today
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Window</span>
            {[7, 14, 30].map((days) => (
              <Button
                key={days}
                type="button"
                variant={rangeDays === days ? "default" : "outline"}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setRangeDays(days)}
              >
                {days}d
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">
                {selectedDay
                  ? formatVietnamDate(selectedDay.date, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })
                  : "No date selected"}
              </p>
              <p className="text-xs text-muted-foreground">
                First column defaults to Vietnam-today. Use week paging to move.
              </p>
            </div>
            {selectedDay ? (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{selectedDay.occupancyRate}% occupied</span>
                <span>{selectedDay.occupied} occupied</span>
                <span>{selectedDay.available} available</span>
              </div>
            ) : null}
          </div>

          <ScrollArea className="w-full whitespace-nowrap">
            <div
              className="grid gap-2 pb-2"
              style={{
                gridTemplateColumns: `repeat(${calendarDays.length}, minmax(88px, 1fr))`,
              }}
            >
              {calendarDays.map((day, index) => (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    day.date === selectedDate
                      ? "border-harbor bg-harbor/10 shadow-sm"
                      : "border-border bg-background hover:bg-accent/60",
                    index === 0 && "ring-1 ring-harbor/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {day.weekday}
                    </span>
                    {day.date === today ? (
                      <span className="rounded bg-harbor px-1.5 py-0.5 text-[10px] font-medium text-harbor-foreground">
                        Today
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-base font-semibold">
                    {day.day}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {day.month}
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {day.occupancyRate}% occ
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {chartData.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No occupancy data available
          </div>
        ) : (
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: -12 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              interval={rangeDays > 14 ? 2 : 0}
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
          </BarChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
