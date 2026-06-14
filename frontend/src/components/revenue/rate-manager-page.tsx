import { useMemo, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRatesPageData } from "@/hooks/use-page-data";
import {
  DollarSign,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  BedDouble,
} from "lucide-react";
import type { Property } from "@/types/database";

function RateManagerSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-lg" />))}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { day: days[d.getUTCDay()], date: d.getUTCDate() };
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatVND(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

export function RateManagerPage() {
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState(getToday());
  const daysToShow = 7;
  const endDate = addDays(startDate, daysToShow - 1);
  const { properties, rates, loading } = useRatesPageData(
    startDate,
    endDate,
    propertyFilter === "all" ? undefined : propertyFilter
  );

  const dates = useMemo(() => Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i)), [startDate]);

  const roomTypes = useMemo(() => {
    const types = new Set<string>();
    rates.forEach((rate) => types.add(rate.room_type));
    return Array.from(types).sort();
  }, [rates]);

  const rateFor = (roomType: string, date: string) => {
    const matchingRates = rates.filter((rate) => rate.room_type === roomType && rate.date === date);
    return matchingRates.find((rate) => rate.property_id === propertyFilter)
      ?? matchingRates.find((rate) => rate.property_id === null)
      ?? matchingRates[0];
  };

  const avgRate = roomTypes.length > 0
    ? Math.round(roomTypes.reduce((sum, t) => {
      const typeRates = rates.filter((rate) => rate.room_type === t);
      const avgTypeRate = typeRates.length > 0
        ? Math.round(typeRates.reduce((typeSum, rate) => typeSum + rate.base_rate_vnd, 0) / typeRates.length)
        : 0;
      return sum + avgTypeRate;
    }, 0) / roomTypes.length)
    : 0;

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <RateManagerHeader
          propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter}
          properties={[]} onPrev={() => {}} onNext={() => {}} onToday={() => {}}
        />
        <RateManagerSkeleton />
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-svh flex-col" data-testid="rate-manager-page">
      <RateManagerHeader
        propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter}
        properties={properties}
        onPrev={() => setStartDate(addDays(startDate, -7))}
        onNext={() => setStartDate(addDays(startDate, 7))}
        onToday={() => setStartDate(getToday())}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Room Types</CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1"><BedDouble className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="type-count">{roomTypes.length}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Avg Base Rate</CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4"><DollarSign className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight" data-testid="avg-rate">{formatVND(avgRate)}</span>
                <span className="text-xs text-muted-foreground ml-1">VND</span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Properties</CardTitle>
                <div className="rounded-md bg-harbor/10 p-1.5 text-harbor"><TrendingUp className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="property-count">{propertyFilter === "all" ? properties.length : 1}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Date Range</CardTitle>
                <div className="rounded-md bg-muted p-1.5 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-sm font-semibold" data-testid="date-range">{startDate} – {endDate}</span></CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-xs" data-testid="rate-grid">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="sticky left-0 z-10 bg-card px-3 py-2.5 text-left font-semibold w-40">Room Type</th>
                      {dates.map((date) => {
                        const info = formatShortDate(date);
                        const isToday = date === getToday();
                        const isWeekend = [0, 6].includes(new Date(date + "T00:00:00Z").getUTCDay());
                        return (
                          <th key={date} className={`px-2 py-2 text-center font-medium min-w-[100px] ${isToday ? "bg-harbor/5" : ""} ${isWeekend ? "bg-chart-4/5" : ""}`}>
                            <div className="text-[10px] text-muted-foreground">{info.day}</div>
                            <div className={`${isToday ? "text-harbor font-bold" : ""}`}>{info.date}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {roomTypes.map((type) => {
                      const base = rates.find((rate) => rate.room_type === type)?.base_rate_vnd ?? 0;
                      return (
                        <tr key={type} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="sticky left-0 z-10 bg-card px-3 py-2.5">
                            <span className="font-semibold">{type}</span>
                            <div className="text-[10px] text-muted-foreground">Base: {formatVND(base)} VND</div>
                          </td>
                          {dates.map((date) => {
                            const isWeekend = [0, 6].includes(new Date(date + "T00:00:00Z").getUTCDay());
                            const rate = rateFor(type, date);
                            const isToday = date === getToday();
                            return (
                              <td key={date} className={`px-2 py-2.5 text-center ${isToday ? "bg-harbor/5" : ""} ${isWeekend ? "bg-chart-4/5" : ""}`}>
                                <div className="font-semibold text-foreground">{rate ? formatVND(rate.rate_vnd) : "—"}</div>
                                {rate && rate.rate_vnd !== rate.base_rate_vnd && <div className="text-[9px] text-chart-4">Override</div>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RateManagerHeader({ propertyFilter, setPropertyFilter, properties, onPrev, onNext, onToday }: {
  propertyFilter: string;
  setPropertyFilter: (v: string) => void;
  properties: Property[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Rate Manager</h2>
          <p className="text-xs text-muted-foreground">Room rates by type and date</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onPrev}><ChevronLeft className="h-3.5 w-3.5" /></Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onToday}><CalendarDays className="h-3.5 w-3.5 mr-1" /> Today</Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onNext}><ChevronRight className="h-3.5 w-3.5" /></Button>
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="h-8 w-44 text-xs" data-testid="property-filter">
            <SelectValue placeholder="All Properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}
