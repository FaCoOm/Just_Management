import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGuestsPageData } from "@/hooks/use-page-data";
import { GuestRequestsTab } from "@/components/guests/guest-requests-tab";
import { StayRecordsTab } from "@/components/guests/stay-records-tab";
import { StayRegistrationTab } from "@/components/guests/stay-registration-tab";

function GuestsSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Card className="gap-3 py-4">
        <CardHeader className="flex flex-row items-center justify-between pb-0">
          <CardTitle className="text-xs font-medium text-muted-foreground">Guests</CardTitle>
          <Skeleton className="h-8 w-32 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-[32rem] w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}

function GuestsHeader({
  propertyId,
  properties,
  onPropertyIdChange,
}: Readonly<{
  propertyId: string;
  properties: { id: string; name: string }[];
  onPropertyIdChange: (propertyId: string) => void;
}>) {
  return (
    <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 h-4" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight">Guests & Tenants</h1>
          <p className="truncate text-xs text-muted-foreground">Stay registration, records, requests</p>
        </div>
        {properties.length > 1 ? (
          <Select value={propertyId} onValueChange={onPropertyIdChange}>
            <SelectTrigger className="h-8 w-[12.5rem] text-xs">
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </header>
  );
}

export function GuestsPage() {
  const { properties, loading } = useGuestsPageData();
  const [propertyId, setPropertyId] = useState("");

  useEffect(() => {
    if (!propertyId && properties[0]?.id) {
      setPropertyId(properties[0].id);
    }
  }, [propertyId, properties]);

  if (loading) {
    return (
      <div className="flex h-full max-h-svh flex-col">
        <GuestsSkeleton />
      </div>
    );
  }

  if (!propertyId) {
    return (
      <div className="flex h-full max-h-svh flex-col">
        <GuestsHeader propertyId="" properties={[]} onPropertyIdChange={() => {}} />
        <div className="flex flex-1 items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">No property yet</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Add a property first, then the Guests shell will load.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-svh flex-col">
      <GuestsHeader propertyId={propertyId} properties={properties} onPropertyIdChange={setPropertyId} />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <Tabs defaultValue="stay-registration" className="w-full gap-4">
            <TabsList variant="line">
              <TabsTrigger value="stay-registration" className="text-xs">Stay Registration</TabsTrigger>
              <TabsTrigger value="stay-records" className="text-xs">Stay Records</TabsTrigger>
              <TabsTrigger value="guest-requests" className="text-xs">Guest Requests</TabsTrigger>
            </TabsList>
            <TabsContent value="stay-registration" className="mt-0">
              <StayRegistrationTab propertyId={propertyId} />
            </TabsContent>
            <TabsContent value="stay-records" className="mt-0">
              <StayRecordsTab propertyId={propertyId} />
            </TabsContent>
            <TabsContent value="guest-requests" className="mt-0">
              <GuestRequestsTab propertyId={propertyId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
