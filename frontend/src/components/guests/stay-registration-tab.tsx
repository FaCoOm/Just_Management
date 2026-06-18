import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCreateStayRegistration, useStayRegistrations, useTenants } from "@/hooks/use-guests-tenants-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { DriveFolderStatus } from "@/types/database";

type StayRegistrationTabProps = {
  propertyId?: string;
};

function driveStatusVariant(status: DriveFolderStatus) {
  switch (status) {
    case "created":
      return "default";
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
}

export function StayRegistrationTab({ propertyId }: StayRegistrationTabProps) {
  const [tenantId, setTenantId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [registrationDate, setRegistrationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [selectedRegistration, setSelectedRegistration] =
    useState<(typeof stayRegistrations)[number] | null>(null);

  const tenantsQuery = useTenants(propertyId ?? "");
  const stayRegistrationsQuery = useStayRegistrations(propertyId ?? "");
  const createStayRegistration = useCreateStayRegistration();

  const tenants = tenantsQuery.data ?? [];
  const stayRegistrations = useMemo(() => {
    return [...(stayRegistrationsQuery.data ?? [])].sort(
      (a, b) => b.registration_date.localeCompare(a.registration_date)
    );
  }, [stayRegistrationsQuery.data]);

  const tenantName = useMemo(() => {
    if (!tenantId) return "";
    return tenants.find((tenant) => tenant.id === tenantId)?.name ?? "";
  }, [tenantId, tenants]);

  const canSubmit = Boolean(propertyId) && guestName.trim().length > 0 && guestCount > 0 && registrationDate;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!propertyId) {
      toast.error("Select a property first.");
      return;
    }
    if (!guestName.trim()) {
      toast.error("Guest name is required.");
      return;
    }

    try {
      await createStayRegistration.mutateAsync({
        property_id: propertyId,
        guest_name: guestName.trim(),
        guest_count: guestCount,
        registration_date: registrationDate,
        tenant_id: tenantId || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Stay registration created.");
      setGuestName("");
      setGuestCount(1);
      setRegistrationDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      setTenantId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create stay registration.");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Stay Registration</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="space-y-1.5 md:col-span-1">
              <label className="text-xs font-medium">Tenant</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={tenantId}
                onChange={(event) => {
                  setTenantId(event.target.value);
                  const next = tenants.find((tenant) => tenant.id === event.target.value);
                  if (next) setGuestName(next.name);
                }}
                disabled={!propertyId || tenantsQuery.isLoading}
              >
                <option value="">Guest fallback</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <label className="text-xs font-medium">Guest Name</label>
              <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={tenantName || "Guest name"} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Guest Count</label>
              <Input type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Registration Date</label>
              <Input type="date" value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium">Notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20 text-sm" placeholder="Optional notes" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="h-9" disabled={!canSubmit || createStayRegistration.isPending}>
                {createStayRegistration.isPending ? "Saving..." : "Register Stay"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold">Stay Registrations</CardTitle>
            <Badge variant="secondary">{stayRegistrations.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 pb-3">
          <Table>
            <TableHeader>
              <TableRow className="border-t border-border">
                <TableHead className="text-xs">Tenant Name</TableHead>
                <TableHead className="text-xs">Guest Count</TableHead>
                <TableHead className="text-xs">Registration Date</TableHead>
                <TableHead className="text-xs">Drive Folder Status</TableHead>
                <TableHead className="text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stayRegistrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No stay registrations yet. Register the first stay above.
                  </TableCell>
                </TableRow>
              ) : (
                stayRegistrations.map((registration) => (
                  <TableRow key={registration.id} className="hover:bg-muted/40">
                    <TableCell className="py-2.5 text-xs">{registration.tenant?.name ?? registration.guest_name}</TableCell>
                    <TableCell className="py-2.5 text-xs">{registration.guest_count}</TableCell>
                    <TableCell className="py-2.5 text-xs">{registration.registration_date}</TableCell>
                    <TableCell className="py-2.5 text-xs">
                      <div className="flex flex-col gap-1.5">
                        <Badge variant={driveStatusVariant(registration.drive_folder_status)} className="w-fit text-[10px] uppercase tracking-wide">
                          {registration.drive_folder_status}
                        </Badge>
                        {registration.drive_folder_status === "created" && registration.drive_folder_id ? (
                          <span className="text-[10px] text-muted-foreground">{registration.drive_folder_id}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => setSelectedRegistration(registration)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={selectedRegistration !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRegistration(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Stay Registration Detail</DialogTitle>
            <DialogDescription>
              Read-only stay registration details and Drive folder status.
            </DialogDescription>
          </DialogHeader>
          {selectedRegistration ? (
            <div className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <Detail label="Tenant / Guest Name" value={selectedRegistration.tenant?.name ?? selectedRegistration.guest_name} />
                <Detail label="Guest Count" value={String(selectedRegistration.guest_count)} />
                <Detail label="Registration Date" value={selectedRegistration.registration_date} />
                <Detail label="Drive Folder Status" value={selectedRegistration.drive_folder_status} />
                {selectedRegistration.drive_folder_status === "created" && selectedRegistration.drive_folder_id ? (
                  <Detail label="Drive Folder ID" value={selectedRegistration.drive_folder_id} />
                ) : null}
              </div>
              {selectedRegistration.notes ? (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-wrap text-sm">{selectedRegistration.notes}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
