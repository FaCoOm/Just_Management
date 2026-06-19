import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenants } from "@/hooks/use-guests-tenants-data";
import { useStayRecordsData } from "@/hooks/use-stay-records-data";
import type { StayExperience, Tenant } from "@/types/database";

type Mode = "short-term" | "long-term";
type SortKey = "name" | "date" | "rent";
type SortDir = "asc" | "desc";

type StayRecordsTabProps = { propertyId: string };

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "2-digit" }).format(date);
}

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function sortDirectionIcon(active: boolean, dir: SortDir) {
  if (!active) return null;
  return dir === "asc" ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />;
}

export function StayRecordsTab({ propertyId }: StayRecordsTabProps) {
  const [mode, setMode] = useState<Mode>("short-term");
  const [search, setSearch] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const tenantsQuery = useTenants(propertyId);
  const stayRecords = useStayRecordsData(propertyId);

  const tenants = tenantsQuery.data ?? [];
  const stayExperiences = mode === "short-term" ? stayRecords.shortTerm : stayRecords.longTerm;

  const normalizedSearch = search.trim().toLowerCase();

  const filteredTenants = useMemo(() => {
    const base = tenants.filter((tenant) => {
      if (vipOnly && !tenant.is_vip) return false;
      if (!normalizedSearch) return true;
      return tenant.name.toLowerCase().includes(normalizedSearch);
    });

    return [...base].sort((a, b) => {
      const sign = sortDir === "asc" ? 1 : -1;
      if (sortKey === "rent") return (a.monthly_rent - b.monthly_rent) * sign;
      const left = sortKey === "date" ? a.lease_start : a.name;
      const right = sortKey === "date" ? b.lease_start : b.name;
      return left.localeCompare(right) * sign;
    });
  }, [tenants, normalizedSearch, sortDir, sortKey, vipOnly]);

  const filteredStays = useMemo(() => {
    const base = stayExperiences.filter((stay) => {
      if (!normalizedSearch) return true;
      return (stay.reservation?.guest_name ?? "").toLowerCase().includes(normalizedSearch);
    });

    return [...base].sort((a, b) => {
      const sign = sortDir === "asc" ? 1 : -1;
      if (sortKey === "date") return a.created_at.localeCompare(b.created_at) * sign;
      return (a.reservation?.guest_name ?? "").localeCompare(b.reservation?.guest_name ?? "") * sign;
    });
  }, [normalizedSearch, sortDir, sortKey, stayExperiences]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((value) => (value === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const openTenantSheet = (tenant: Tenant) => setSelectedTenant(tenant);

  return (
    <div className="space-y-4 p-4" data-testid="stay-records-tab">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex rounded-md border border-border bg-muted p-1">
          <Button type="button" size="sm" variant={mode === "short-term" ? "default" : "ghost"} onClick={() => setMode("short-term")} className="h-8 rounded-sm px-3 text-xs">
            <Users className="mr-1.5 h-3.5 w-3.5" /> Short-term Guests
          </Button>
          <Button type="button" size="sm" variant={mode === "long-term" ? "default" : "ghost"} onClick={() => setMode("long-term")} className="h-8 rounded-sm px-3 text-xs">
            <UserRound className="mr-1.5 h-3.5 w-3.5" /> Long-term Tenants
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" className="pl-9" />
          </div>
          <Select value={vipOnly ? "vip" : "all"} onValueChange={(value) => setVipOnly(value === "vip") }>
            <SelectTrigger size="sm" className="w-full sm:w-44">
              <SelectValue placeholder="VIP filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tenants</SelectItem>
              <SelectItem value="vip">VIP only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {mode === "short-term" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><button type="button" className="inline-flex items-center" onClick={() => toggleSort("name")}>Guest Name{sortDirectionIcon(sortKey === "name", sortDir)}</button></TableHead>
              <TableHead>Property</TableHead>
              <TableHead><button type="button" className="inline-flex items-center" onClick={() => toggleSort("date")}>Check-in / Registration{sortDirectionIcon(sortKey === "date", sortDir)}</button></TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead>Guest Count</TableHead>
              <TableHead>Registration Date</TableHead>
              <TableHead>Drive Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No short-term guests found</TableCell>
              </TableRow>
            ) : filteredStays.map((stay: StayExperience) => (
              <TableRow key={stay.id}>
                <TableCell className="font-medium">{stay.reservation?.guest_name ?? "—"}</TableCell>
                <TableCell>{stay.reservation?.property_id ?? propertyId}</TableCell>
                <TableCell>{formatDate(stay.reservation?.check_in_date ?? stay.created_at)}</TableCell>
                <TableCell>{formatDate(stay.reservation?.check_out_date)}</TableCell>
                <TableCell>{stay.reservation?.guest_count ?? "—"}</TableCell>
                <TableCell>{formatDate(stay.created_at)}</TableCell>
                <TableCell><Badge variant="outline">{stay.stay_type ?? "—"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><button type="button" className="inline-flex items-center" onClick={() => toggleSort("name")}>Name{sortDirectionIcon(sortKey === "name", sortDir)}</button></TableHead>
              <TableHead>Property</TableHead>
              <TableHead><button type="button" className="inline-flex items-center" onClick={() => toggleSort("date")}>Lease Start{sortDirectionIcon(sortKey === "date", sortDir)}</button></TableHead>
              <TableHead>Lease End</TableHead>
              <TableHead><button type="button" className="inline-flex items-center" onClick={() => toggleSort("rent")}>Monthly Rent{sortDirectionIcon(sortKey === "rent", sortDir)}</button></TableHead>
              <TableHead>Deposit</TableHead>
              <TableHead>ID Document Type</TableHead>
              <TableHead>Emergency Contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No tenants found</TableCell>
              </TableRow>
            ) : filteredTenants.map((tenant) => (
              <TableRow key={tenant.id} className="cursor-pointer" onClick={() => openTenantSheet(tenant)}>
                <TableCell className="font-medium">{tenant.name}{tenant.is_vip ? <Badge variant="secondary" className="ml-2">VIP</Badge> : null}</TableCell>
                <TableCell>{tenant.property?.name ?? "—"}</TableCell>
                <TableCell>{formatDate(tenant.lease_start)}</TableCell>
                <TableCell>{formatDate(tenant.lease_end)}</TableCell>
                <TableCell>{formatCurrency(tenant.monthly_rent)}</TableCell>
                <TableCell>{formatCurrency(tenant.deposit_amount)}</TableCell>
                <TableCell>{tenant.id_document_type}</TableCell>
                <TableCell>{tenant.emergency_contact_name ? `${tenant.emergency_contact_name}${tenant.emergency_contact_phone ? ` · ${tenant.emergency_contact_phone}` : ""}` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Sheet open={selectedTenant !== null} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {selectedTenant ? (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle>{selectedTenant.name}</SheetTitle>
                <SheetDescription>Read-only tenant profile and linked stay registrations.</SheetDescription>
              </SheetHeader>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <Detail label="Property" value={selectedTenant.property?.name ?? "—"} />
                <Detail label="Status" value={selectedTenant.status} />
                <Detail label="Lease Start" value={formatDate(selectedTenant.lease_start)} />
                <Detail label="Lease End" value={formatDate(selectedTenant.lease_end)} />
                <Detail label="Monthly Rent" value={formatCurrency(selectedTenant.monthly_rent)} />
                <Detail label="Deposit" value={formatCurrency(selectedTenant.deposit_amount)} />
                <Detail label="ID Document Type" value={selectedTenant.id_document_type} />
                <Detail label="Emergency Contact" value={selectedTenant.emergency_contact_name ? `${selectedTenant.emergency_contact_name}${selectedTenant.emergency_contact_phone ? ` · ${selectedTenant.emergency_contact_phone}` : ""}` : "—"} />
                <Detail label="Email" value={selectedTenant.email ?? "—"} />
                <Detail label="Phone" value={selectedTenant.phone ?? "—"} />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Stay registrations</h3>
                <div className="space-y-2">
                  {stayRecords.longTerm.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No linked stay registrations</p>
                  ) : stayRecords.longTerm.map((stay) => (
                    <div key={stay.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{stay.reservation?.guest_name ?? selectedTenant.name}</span>
                        <Badge variant="outline">{stay.stay_type ?? "long_term"}</Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
                        <span>Property: {stay.reservation?.property_id ?? propertyId}</span>
                        <span>Guests: {stay.reservation?.guest_count ?? "—"}</span>
                        <span>Check-in: {formatDate(stay.reservation?.check_in_date)}</span>
                        <span>Reference: {stay.platform_reference ?? "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
