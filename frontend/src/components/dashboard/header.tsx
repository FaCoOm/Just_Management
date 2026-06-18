import { Search, Bell, CalendarDays, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { formatVietnamDate, formatVietnamRangeLabel } from "@/lib/vietnam-time";
import { useRunPipeline } from "@/hooks/use-run-pipeline";

interface DashboardHeaderProps {
  today: string;
}

export function DashboardHeader({ today }: DashboardHeaderProps) {
  const rangeLabel = formatVietnamRangeLabel(today, 7);
  const runPipeline = useRunPipeline();

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />

      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-base font-semibold tracking-[-0.005em]">Portfolio Dashboard</h2>
          <p className="text-xs text-muted-foreground">
            Vietnam time (GMT+7) · {formatVietnamDate(today, {
              weekday: "long",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden h-8 gap-1.5 text-xs sm:flex"
          disabled={runPipeline.isPending}
          onClick={() => runPipeline.mutate()}
        >
          <RefreshCw className={runPipeline.isPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {runPipeline.isPending ? "Syncing" : "Sync Now"}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </Button>
        <ModeToggle />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 gap-1.5 text-xs sm:flex"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Last 7 days
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 text-xs lg:flex"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {rangeLabel}
        </Button>
      </div>
    </header>
  );
}
