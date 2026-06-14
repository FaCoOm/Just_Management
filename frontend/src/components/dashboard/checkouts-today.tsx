import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Guest, Property, Room } from "@/types/database";

interface CheckoutsTodayProps {
  guests: Guest[];
  properties: Property[];
  rooms: Room[];
}

export function CheckoutsToday({
  guests,
  properties,
  rooms,
}: CheckoutsTodayProps) {
  const sortedGuests = [...guests].sort((left, right) => {
    const leftPriority = left.check_in_status === "Check-Out Pending" ? 0 : 1;
    const rightPriority = right.check_in_status === "Check-Out Pending" ? 0 : 1;
    return leftPriority - rightPriority || left.guest_name.localeCompare(right.guest_name);
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="font-serif text-lg">Checkouts Today</CardTitle>
        <Badge variant="outline">{sortedGuests.length}</Badge>
      </CardHeader>
      <CardContent className="px-0">
        {sortedGuests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No checkouts scheduled today
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6 text-xs">Guest</TableHead>
                <TableHead className="text-xs">Property</TableHead>
                <TableHead className="text-xs">Room</TableHead>
                <TableHead className="pr-6 text-xs text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedGuests.map((guest) => {
                const property = properties.find(
                  (item) => item.id === guest.property_id
                );
                const room = rooms.find((item) => item.id === guest.room_id);
                const isPending = guest.check_in_status === "Check-Out Pending";

                return (
                  <TableRow key={guest.id}>
                    <TableCell className="pl-6">
                      <div>
                        <p className="text-sm font-medium">{guest.guest_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {guest.guest_count}{" "}
                          {guest.guest_count === 1 ? "guest" : "guests"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {property?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {room ? (
                        <>
                          {room.room_number}
                          <span className="ml-1 text-[11px] text-muted-foreground">
                            {room.room_type}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Badge
                        variant="outline"
                        className={
                          isPending
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }
                      >
                        {isPending ? "Pending" : "Completed"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
