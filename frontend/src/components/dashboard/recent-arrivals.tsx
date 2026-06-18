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
import { useVietnamClock } from "@/hooks/use-vietnam-clock";
import { formatVietnamRelativeDay } from "@/lib/vietnam-time";
import type { Guest, Room } from "@/types/database";

interface RecentArrivalsProps {
  guests: Guest[];
  rooms: Room[];
}

export function RecentArrivals({ guests, rooms }: RecentArrivalsProps) {
  const { now } = useVietnamClock();
  const recentGuests = [...guests]
    .filter((guest) => guest.check_in_status === "Checked In" && guest.room_id)
    .sort((left, right) => {
      const leftTime = left.eta ? new Date(left.eta).getTime() : 0;
      const rightTime = right.eta ? new Date(right.eta).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-[-0.005em]">Recent Arrivals</CardTitle>
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
                ? formatVietnamRelativeDay(guest.eta, now)
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
