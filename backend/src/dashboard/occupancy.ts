type PropertyLike = {
  id: string;
  total_rooms: number;
};

type RoomLike = {
  id: string;
  property_id: string;
};

type ReservationLike = {
  id: string;
  primary_room_id: string | null;
  check_in_date: Date | string;
  check_out_date: Date | string;
  reservation_room_allocations: Array<{ room_id: string }>;
};

type OccupancyMetricsInput = {
  date: string;
  properties: PropertyLike[];
  rooms: RoomLike[];
  reservations: ReservationLike[];
};

type PropertyOccupancyMetric = {
  occupiedRoomIds: Set<string>;
  occupiedRooms: number;
  totalRooms: number;
  occupancyRate: number;
};

export type OccupancyMetrics = {
  perProperty: Map<string, PropertyOccupancyMetric>;
  totalOccupied: number;
  totalRooms: number;
  occupancyRate: number;
};

function toDateKey(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function roomIdsForReservation(reservation: ReservationLike) {
  if (reservation.reservation_room_allocations.length > 0) {
    return reservation.reservation_room_allocations.map((allocation) => allocation.room_id);
  }

  return reservation.primary_room_id ? [reservation.primary_room_id] : [];
}

export function deriveOccupancyMetrics({
  date,
  properties,
  rooms,
  reservations,
}: OccupancyMetricsInput): OccupancyMetrics {
  const roomPropertyById = new Map(rooms.map((room) => [room.id, room.property_id]));
  const occupiedByProperty = new Map<string, Set<string>>(
    properties.map((property) => [property.id, new Set<string>()])
  );
  const totalOccupiedRoomIds = new Set<string>();

  for (const reservation of reservations) {
    const checkIn = toDateKey(reservation.check_in_date);
    const checkOut = toDateKey(reservation.check_out_date);
    if (!(checkIn <= date && date < checkOut)) continue;

    const reservationRoomIds = roomIdsForReservation(reservation);
    if (reservationRoomIds.length === 0) {
      totalOccupiedRoomIds.add(`reservation:${reservation.id}`);
      continue;
    }

    for (const roomId of reservationRoomIds) {
      totalOccupiedRoomIds.add(roomId);
      const propertyId = roomPropertyById.get(roomId);
      if (!propertyId) continue;
      occupiedByProperty.get(propertyId)?.add(roomId);
    }
  }

  const perProperty = new Map<string, PropertyOccupancyMetric>();
  let totalRooms = 0;

  for (const property of properties) {
    const propertyRoomCount = rooms.filter((room) => room.property_id === property.id).length;
    const propertyTotalRooms = propertyRoomCount || property.total_rooms || 0;
    const occupiedRoomIds = occupiedByProperty.get(property.id) ?? new Set<string>();
    const occupiedRooms = occupiedRoomIds.size;
    totalRooms += propertyTotalRooms;

    perProperty.set(property.id, {
      occupiedRoomIds,
      occupiedRooms,
      totalRooms: propertyTotalRooms,
      occupancyRate: propertyTotalRooms > 0 ? Math.round((occupiedRooms / propertyTotalRooms) * 100) : 0,
    });
  }

  const totalOccupied = totalOccupiedRoomIds.size;

  return {
    perProperty,
    totalOccupied,
    totalRooms,
    occupancyRate: totalRooms > 0 ? Math.round((totalOccupied / totalRooms) * 100) : 0,
  };
}
