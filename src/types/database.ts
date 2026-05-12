export interface Property {
  id: string;
  name: string;
  slug: string;
  total_rooms: number;
  location: string;
  status: string;
  created_at: string;
}

export type RoomStatus =
  | "Vacant"
  | "Occupied"
  | "Check-In Pending"
  | "Checked In"
  | "Check-Out Pending"
  | "Checked Out"
  | "Needs Attention";

export interface Room {
  id: string;
  property_id: string;
  room_number: string;
  room_name: string;
  room_type: string;
  status: RoomStatus;
  passcode: string;
  floor: number;
  created_at: string;
}

export type ReservationStatus =
  | "pending"
  | "check_in_pending"
  | "checked_in"
  | "check_out_pending"
  | "checked_out"
  | "cancelled"
  | "no_show";

export interface Reservation {
  id: string;
  property_id: string;
  primary_room_id: string | null;
  status: ReservationStatus;
  check_in_date: string;
  check_out_date: string;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  adult_count: number;
  child_count: number;
  infant_count: number;
  guest_count: number;
  operational_notes: string;
  guest_notes: string;
  created_at: string;
  updated_at: string;
}

export type ReservationAllocationRole =
  | "stay"
  | "primary"
  | "overflow"
  | "split_stay";

export interface ReservationRoomAllocation {
  id: string;
  reservation_id: string;
  room_id: string;
  allocation_role: ReservationAllocationRole;
  sort_order: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type CheckInStatus =
  | "Pending"
  | "Checked In"
  | "Check-In Pending"
  | "Check-Out Pending"
  | "Checked Out";

export interface DashboardGuest {
  id: string;
  reservation_id: string;
  property_id: string;
  room_id: string | null;
  guest_name: string;
  eta: string | null;
  etd: string | null;
  check_in_status: CheckInStatus;
  booking_source: string;
  is_vip: boolean;
  guest_count: number;
  created_at: string;
}

// Compatibility view model: dashboard and guest-labeled panels still consume
// `Guest`, but `useDashboardData` now derives these rows from `reservations`.
export type Guest = DashboardGuest;

export interface GuestRequest {
  id: string;
  guest_id: string;
  reservation_id: string | null;
  property_id: string | null;
  room_id: string;
  request_type: string;
  notes: string;
  is_completed: boolean;
  created_at: string;
}

export type Severity = "Low" | "Medium" | "High" | "Critical";
export type MaintenanceStatus = "Open" | "In Progress" | "Resolved";

export interface MaintenanceIssue {
  id: string;
  property_id: string;
  room_id: string | null;
  title: string;
  description: string;
  severity: Severity;
  status: MaintenanceStatus;
  created_at: string;
}

export interface PropertyMetrics {
  property: Property;
  arrivals: number;
  departures: number;
  occupancyRate: number;
  occupiedRooms: number;
  maintenanceOpen: number;
}

export interface OccupancySeriesPoint {
  date: string;
  occupied: number;
  available: number;
  totalRooms: number;
}
