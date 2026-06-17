import type { RoomStatus } from "@/types/database";

export const roomStatusConfig: Record<
  RoomStatus,
  { label: string; dot: string; card: string }
> = {
  Vacant: {
    label: "Vacant",
    dot: "bg-emerald-500",
    card: "border-emerald-200 dark:border-emerald-800",
  },
  Occupied: {
    label: "Occupied",
    dot: "bg-chart-1",
    card: "border-chart-1/30",
  },
  "Checked In": {
    label: "Checked In",
    dot: "bg-chart-1",
    card: "border-chart-1/30",
  },
  "Check-In Pending": {
    label: "Arriving",
    dot: "bg-chart-4",
    card: "border-chart-4/30",
  },
  "Check-Out Pending": {
    label: "Departing",
    dot: "bg-amber-500",
    card: "border-amber-200 dark:border-amber-800",
  },
  "Checked Out": {
    label: "Checked Out",
    dot: "bg-muted-foreground/40",
    card: "border-border",
  },
  "Needs Attention": {
    label: "Needs Attention",
    dot: "bg-destructive",
    card: "border-destructive/30",
  },
};

export const roomStatusOptions = Object.keys(roomStatusConfig) as RoomStatus[];
