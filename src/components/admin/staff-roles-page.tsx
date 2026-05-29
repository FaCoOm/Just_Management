import { useMemo, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useReservationsPageData } from "@/hooks/use-page-data";
import { UserCog, Shield, Users, Search, Plus, Building2 } from "lucide-react";
import type { Property } from "@/types/database";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "accountant" | "staff";
  propertyIds: string[];
  status: "active" | "inactive";
  lastActive: string;
}

const roleConfig: Record<string, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-destructive/10 text-destructive border-destructive/20" },
  manager: { label: "Manager", className: "bg-chart-1/10 text-chart-1 border-chart-1/20" },
  accountant: { label: "Accountant", className: "bg-chart-4/10 text-chart-4 border-chart-4/20" },
  staff: { label: "Staff", className: "bg-muted text-muted-foreground border-border" },
};

function StaffRolesSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-lg" />))}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

function generateStaff(properties: Property[]): StaffMember[] {
  const roles: StaffMember["role"][] = ["admin", "manager", "accountant", "staff"];
  const names = ["Robert Austin", "Linh Tran", "David Kim", "Mai Nguyen", "James Wilson", "Hoa Pham", "Sophie Chen", "Thanh Le", "Carlos Rodriguez", "Anna Baker"];
  return names.map((name, i) => ({
    id: `staff-${i}`,
    name,
    email: `${name.toLowerCase().replace(" ", ".")}@justmanagement.co`,
    role: roles[i % roles.length],
    propertyIds: i < 2 ? properties.map((p) => p.id) : [properties[i % properties.length]?.id].filter(Boolean),
    status: i === 8 ? "inactive" : "active",
    lastActive: new Date(Date.now() - i * 3600000).toISOString(),
  }));
}

export function StaffRolesPage() {
  const { properties, loading } = useReservationsPageData();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const staff = useMemo(() => generateStaff(properties), [properties]);
  const filtered = useMemo(() => staff.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || s.role === roleFilter;
    return matchSearch && matchRole;
  }), [staff, search, roleFilter]);

  const activeCount = staff.filter((s) => s.status === "active").length;
  const adminCount = staff.filter((s) => s.role === "admin").length;
  const managerCount = staff.filter((s) => s.role === "manager").length;

  if (loading) {
    return (<div className="flex h-full flex-col"><StaffHeader /><StaffRolesSkeleton /></div>);
  }

  return (
    <div className="flex h-full max-h-svh flex-col" data-testid="staff-roles-page">
      <StaffHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Staff</CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1"><Users className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="total-staff">{staff.length}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Active</CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"><UserCog className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="active-staff">{activeCount}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Admins</CardTitle>
                <div className="rounded-md bg-destructive/10 p-1.5 text-destructive"><Shield className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="admin-count">{adminCount}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Managers</CardTitle>
                <div className="rounded-md bg-harbor/10 p-1.5 text-harbor"><Building2 className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="manager-count">{managerCount}</span></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-sm font-semibold">Staff Directory</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-44 pl-8 text-xs" data-testid="search-staff" />
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All Roles" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="accountant">Accountant</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {filtered.map((member) => {
                const config = roleConfig[member.role];
                const initials = member.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
                const propNames = member.propertyIds.map((pid) => properties.find((p) => p.id === pid)?.name).filter(Boolean);
                return (
                  <div key={member.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-muted/40 transition-colors" data-testid={`staff-row-${member.id}`}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className={`text-xs ${member.role === "admin" ? "bg-harbor text-harbor-foreground" : "bg-secondary"}`}>{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{member.name}</p>
                          <Badge variant="outline" className={`text-[9px] ${config.className}`}>{config.label}</Badge>
                          {member.status === "inactive" && <Badge variant="outline" className="text-[9px] bg-muted text-muted-foreground border-border">Inactive</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {propNames.length === properties.length ? "All properties" : propNames.slice(0, 2).join(", ")}
                        {propNames.length > 2 && ` +${propNames.length - 2}`}
                      </p>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="py-8 text-center">
                  <Users className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No staff members found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StaffHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Staff & Roles</h2>
          <p className="text-xs text-muted-foreground">Team directory and permission management</p>
        </div>
      </div>
      <Button size="sm" className="h-8 gap-1.5 text-xs bg-harbor text-harbor-foreground hover:bg-harbor-deep" data-testid="add-staff-btn">
        <Plus className="h-3.5 w-3.5" />
        Add Staff
      </Button>
    </header>
  );
}
