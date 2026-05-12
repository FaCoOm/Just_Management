import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatVietnamDate } from "@/lib/vietnam-time";
import type { Guest, Property, Room } from "@/types/database";

interface ArrivalsDetailProps {
  guests: Guest[];
  properties: Property[];
  rooms: Room[];
}

export function ArrivalsDetail({ guests, properties, rooms }: ArrivalsDetailProps) {
  const grouped = properties
    .map((p) => ({
      property: p,
      guests: guests.filter((g) => g.property_id === p.id),
    }))
    .filter((g) => g.guests.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Arrivals Today</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {grouped.map(({ property, guests: propGuests }) => (
          <div key={property.id} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {property.name}
            </p>
            <div className="space-y-1.5">
              {propGuests.map((guest) => {
                const room = rooms.find((r) => r.id === guest.room_id);
                const initials = guest.guest_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2);
                const eta = guest.eta ? formatVietnamDate(guest.eta) : "TBD";

                return (
                  <div
                    key={guest.id}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-secondary text-[10px]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {guest.guest_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {room?.room_type} {room?.room_number} &middot; Check-in {eta}
                      </p>
                    </div>
                    {guest.is_vip && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
                        VIP
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No arrivals scheduled today
          </p>
        )}
      </CardContent>
    </Card>
  );
}
