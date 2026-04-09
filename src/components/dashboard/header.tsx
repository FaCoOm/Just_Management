import { Search, Bell, CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function DashboardHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />

      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Hello Robert</h2>
          <p className="text-xs text-muted-foreground">
            Welcome back to Latte Lounge
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </Button>
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
          Apr 03 - Apr 09, 2026
        </Button>
      </div>
    </header>
  );
}
