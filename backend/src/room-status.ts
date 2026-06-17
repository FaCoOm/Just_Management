const ROOM_STATUSES = [
  "Vacant",
  "Occupied",
  "Check-In Pending",
  "Checked In",
  "Check-Out Pending",
  "Checked Out",
  "Needs Attention",
] as const;

type RoomStatus = (typeof ROOM_STATUSES)[number];
type ReservationStatus =
  | "pending"
  | "check_in_pending"
  | "checked_in"
  | "check_out_pending"
  | "checked_out"
  | "cancelled"
  | "no_show";

type RoomRecord = {
  id: string;
  property_id: string;
  room_number: string;
  room_name: string;
  room_type: string;
  status: string;
  floor: number;
  created_at: Date | string;
};

type ReservationRecord = {
  id: string;
  property_id: string;
  primary_room_id: string | null;
  status: string;
  check_in_date: Date | string;
  check_out_date: Date | string;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  adult_count: number;
  child_count: number;
  infant_count: number;
  guest_count: number;
  operational_notes: string;
  guest_notes: string;
  created_at: Date | string;
  updated_at: Date | string;
  reservation_room_allocations?: unknown[];
};

type RoomWhere = { id: string };
type ReservationWhere = {
  OR: Array<
    | { primary_room_id: string }
    | { reservation_room_allocations: { some: { room_id: string } } }
  >;
  status: { notIn: ReservationStatus[] };
  check_in_date: { lte: Date };
  check_out_date: { gt: Date };
};

export type RoomStatusTransactionClient = {
  rooms: {
    update(args: { where: RoomWhere; data: { status: RoomStatus } }): Promise<RoomRecord>;
  };
  reservations: {
    update(args: { where: { id: string }; data: { status: ReservationStatus } }): Promise<ReservationRecord>;
  };
};

export type RoomStatusPrisma = {
  rooms: {
    findUnique(args: { where: RoomWhere }): Promise<RoomRecord | null>;
  };
  reservations: {
    findFirst(args: {
      where: ReservationWhere;
      include: { reservation_room_allocations: true };
      orderBy: { check_in_date: "desc" };
    }): Promise<ReservationRecord | null>;
  };
  $transaction<T>(callback: (tx: RoomStatusTransactionClient) => Promise<T>): Promise<T>;
};

export type RoomStatusUpdateResult =
  | { status: 200; body: { room: RoomRecord; reservation: ReservationRecord | null } }
  | { status: 400; body: { error: "Invalid room status" } }
  | { status: 404; body: { error: "Room not found" } }
  | { status: 409; body: { error: "No active reservation for room" } };

export function isRoomStatus(value: unknown): value is RoomStatus {
  return typeof value === "string" && ROOM_STATUSES.includes(value as RoomStatus);
}

function toDateOnly(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function reservationStatusFor(roomStatus: RoomStatus): ReservationStatus | null {
  switch (roomStatus) {
    case "Check-In Pending":
      return "check_in_pending";
    case "Checked In":
    case "Occupied":
      return "checked_in";
    case "Check-Out Pending":
      return "check_out_pending";
    case "Checked Out":
      return "checked_out";
    default:
      return null;
  }
}

export async function applyRoomStatusUpdate(
  prisma: RoomStatusPrisma,
  roomId: string,
  requestedStatus: unknown,
  todayKey: string
): Promise<RoomStatusUpdateResult> {
  if (!isRoomStatus(requestedStatus)) {
    return { status: 400, body: { error: "Invalid room status" } };
  }

  const room = await prisma.rooms.findUnique({ where: { id: roomId } });
  if (!room) {
    return { status: 404, body: { error: "Room not found" } };
  }

  const today = toDateOnly(todayKey);
  const activeReservation = await prisma.reservations.findFirst({
    where: {
      OR: [
        { primary_room_id: roomId },
        { reservation_room_allocations: { some: { room_id: roomId } } },
      ],
      status: { notIn: ["cancelled", "no_show"] },
      check_in_date: { lte: today },
      check_out_date: { gt: today },
    },
    include: { reservation_room_allocations: true },
    orderBy: { check_in_date: "desc" },
  });

  if (requestedStatus === "Needs Attention") {
    const updatedRoom = await prisma.$transaction((tx) =>
      tx.rooms.update({ where: { id: roomId }, data: { status: requestedStatus } })
    );
    return { status: 200, body: { room: updatedRoom, reservation: null } };
  }

  if (requestedStatus === "Vacant" && room.status === "Needs Attention") {
    const updatedRoom = await prisma.$transaction((tx) =>
      tx.rooms.update({ where: { id: roomId }, data: { status: requestedStatus } })
    );
    return { status: 200, body: { room: updatedRoom, reservation: null } };
  }

  if (!activeReservation) {
    if (requestedStatus === "Vacant") {
      const updatedRoom = await prisma.$transaction((tx) =>
        tx.rooms.update({ where: { id: roomId }, data: { status: requestedStatus } })
      );
      return { status: 200, body: { room: updatedRoom, reservation: null } };
    }
    return { status: 409, body: { error: "No active reservation for room" } };
  }

  const nextReservationStatus =
    requestedStatus === "Vacant"
      ? "checked_out"
      : reservationStatusFor(requestedStatus);

  if (!nextReservationStatus) {
    return { status: 400, body: { error: "Invalid room status" } };
  }

  const { updatedRoom, updatedReservation } = await prisma.$transaction(async (tx) => ({
    updatedRoom: await tx.rooms.update({
      where: { id: roomId },
      data: { status: requestedStatus },
    }),
    updatedReservation: await tx.reservations.update({
      where: { id: activeReservation.id },
      data: { status: nextReservationStatus },
    }),
  }));

  return { status: 200, body: { room: updatedRoom, reservation: updatedReservation } };
}
