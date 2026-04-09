import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Guest, Room } from "@/types/database";
import { formatDistanceToNow } from "date-fns";

interface RecentArrivalsProps {
  guests: Guest[];
  rooms: Room[];
}

export function RecentArrivals({ guests, rooms }: RecentArrivalsProps) {
  const recentGuests = guests
    .filter((g) => g.check_in_status === "Checked In" && g.room_id)
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Recent Arrivals</CardTitle>
        <CardAction>
          <Button variant="link" size="sm" className="text-xs">
            View All
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6 text-xs">R. No</TableHead>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="pr-6 text-xs text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentGuests.map((guest) => {
              const room = rooms.find((r) => r.id === guest.room_id);
              const initials = guest.guest_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2);
              const timeAgo = guest.eta
                ? formatDistanceToNow(new Date(guest.eta), { addSuffix: true })
                : "recently";

              return (
                <TableRow key={guest.id}>
                  <TableCell className="pl-6 text-xs font-medium">
                    #{room?.room_number ?? "---"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-secondary text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{guest.guest_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                    {timeAgo}
                  </TableCell>
                </TableRow>
              );
            })}
            {recentGuests.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                  No recent arrivals
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
