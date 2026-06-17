import type { Reservation, Room, RoomStatus } from "@/types/database";

const NON_OCCUPYING_RESERVATION_STATUSES = new Set(["cancelled", "checked_out", "no_show"]);

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateKey(date: string) {
  return date.slice(0, 10);
}

function reservationRoomIds(reservation: Reservation) {
  if (reservation.reservation_room_allocations && reservation.reservation_room_allocations.length > 0) {
    return reservation.reservation_room_allocations.map((allocation) => allocation.room_id);
  }

  return reservation.primary_room_id ? [reservation.primary_room_id] : [];
}

function reservationOverlapsDate(reservation: Reservation, today: string) {
  const checkIn = dateKey(reservation.check_in_date);
  const checkOut = dateKey(reservation.check_out_date);
  return checkIn <= today && today < checkOut;
}

function statusForReservation(reservation: Reservation, today: string): RoomStatus {
  const checkIn = dateKey(reservation.check_in_date);
  const checkOut = dateKey(reservation.check_out_date);

  if (["pending", "check_in_pending"].includes(reservation.status) && checkIn === today) {
    return "Check-In Pending";
  }

  if (
    ["checked_in", "check_out_pending"].includes(reservation.status) &&
    addDays(checkOut, -1) === today
  ) {
    return "Check-Out Pending";
  }

  if (reservation.status === "checked_in") {
    return "Checked In";
  }

  return "Occupied";
}

export function deriveRoomDisplayStatus(
  room: Room,
  reservations: Reservation[],
  today: string
): RoomStatus {
  if (room.status === "Needs Attention") {
    return "Needs Attention";
  }

  const activeReservation = reservations.find(
    (reservation) =>
      reservationRoomIds(reservation).includes(room.id) &&
      !NON_OCCUPYING_RESERVATION_STATUSES.has(reservation.status) &&
      reservationOverlapsDate(reservation, today)
  );

  return activeReservation ? statusForReservation(activeReservation, today) : "Vacant";
}
