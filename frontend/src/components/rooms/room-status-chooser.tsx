import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { roomStatusConfig, roomStatusOptions } from "@/lib/room-status-config";
import type { RoomStatus } from "@/types/database";

interface RoomStatusChooserProps {
  open: boolean;
  currentStatus: RoomStatus;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (status: RoomStatus) => void;
}

export function RoomStatusChooser({
  open,
  currentStatus,
  isPending,
  onOpenChange,
  onSelect,
}: Readonly<RoomStatusChooserProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update room status</DialogTitle>
          <DialogDescription>
            Choose the operational status to apply to this room.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {roomStatusOptions.map((status) => {
            const config = roomStatusConfig[status];
            const isCurrent = status === currentStatus;
            return (
              <Button
                key={status}
                type="button"
                variant="outline"
                className="justify-start gap-2"
                disabled={isPending || isCurrent}
                onClick={() => onSelect(status)}
              >
                <span className={`h-2 w-2 rounded-full ${config.dot}`} />
                {config.label}
                {isCurrent ? <span className="ml-auto text-xs text-muted-foreground">Current</span> : null}
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
