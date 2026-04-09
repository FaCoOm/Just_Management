import {
  LayoutDashboard,
  CalendarCheck,
  ClipboardList,
  Users,
  BedDouble,
  Map,
  Layers,
  CalendarRange,
  Sparkles,
  UtensilsCrossed,
  DollarSign,
  FileText,
  Globe,
  UserCog,
  Wrench,
  ShieldCheck,
  ChevronDown,
  Coffee,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const frontOfficeItems = [
  { title: "Dashboard", icon: LayoutDashboard, isActive: true },
  { title: "Reservations", icon: CalendarCheck },
  { title: "Check-in / Check-out", icon: ClipboardList },
];

const roomsSubItems = [
  { title: "Floor Plan", icon: Map },
  { title: "Room Types", icon: Layers },
  { title: "Availability", icon: CalendarRange },
];

const propertyItems = [
  { title: "Housekeeping", icon: Sparkles },
  { title: "Dining & Events", icon: UtensilsCrossed },
];

const revenueItems = [
  { title: "Rate Manager", icon: DollarSign },
  { title: "Billing & Invoices", icon: FileText },
  { title: "Channel Distribution", icon: Globe },
];

const adminItems = [
  { title: "Staff & Roles", icon: UserCog },
  { title: "Maintenance Logs", icon: Wrench },
  { title: "Security & Access", icon: ShieldCheck },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-harbor text-harbor-foreground">
            <Coffee className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">
              Latte Lounge
            </span>
            <span className="text-xs text-muted-foreground">
              Hospitality Suite
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Front Office</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {frontOfficeItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton isActive={item.isActive}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <Collapsible className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <Users />
                      <span>Guest Profiles</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton>All Guests</SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton>VIP Guests</SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Property</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <BedDouble />
                      <span>Rooms & Suites</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {roomsSubItems.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton>
                            {item.title}
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              {propertyItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Revenue</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {revenueItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-harbor text-harbor-foreground text-xs">
                      RA
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-medium">Robert Austin</span>
                    <span className="text-xs text-muted-foreground">
                      robert@lattelounge.co
                    </span>
                  </div>
                  <ChevronDown className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
