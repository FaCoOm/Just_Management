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
  reservation_room_allocations?: ReservationRoomAllocation[];
}

export interface ReservationCreateInput {
  property_id: string;
  primary_room_id?: string | null;
  status?: ReservationStatus;
  check_in_date: string;
  check_out_date: string;
  guest_name: string;
  guest_phone?: string | null;
  guest_email?: string | null;
  adult_count: number;
  child_count: number;
  infant_count: number;
  guest_count: number;
  operational_notes?: string;
  guest_notes?: string;
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
  guest_id: string | null;
  reservation_id: string | null;
  property_id: string | null;
  room_id: string | null;
  request_type: string;
  notes: string;
  is_completed: boolean;
  status?: GuestRequestStatus;
  priority?: GuestRequestPriority;
  assigned_to?: string | null;
  description?: string | null;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
}

export type GuestRequestStatus = "open" | "assigned" | "in_progress" | "fulfilled" | "closed" | "reopened";
export type GuestRequestPriority = "low" | "medium" | "high" | "urgent";
export type DriveFolderStatus = "pending" | "created" | "failed";
export type TenantStatus = "active" | "inactive" | "archived";
export type IdDocumentType = "passport" | "national_id" | "drivers_license" | "other";

export interface Tenant {
  id: string;
  property_id: string;
  property?: Property;
  name: string;
  email?: string | null;
  phone?: string | null;
  id_document_type: IdDocumentType;
  id_document_number: string;
  nationality?: string | null;
  lease_start: string;
  lease_end: string;
  monthly_rent: number;
  deposit_amount?: number | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
  status: TenantStatus;
  is_vip?: boolean;
  created_at: string;
  updated_at: string;
}

export interface StayRegistration {
  id: string;
  property_id: string;
  property?: Property;
  tenant_id?: string | null;
  tenant?: Tenant;
  room_id?: string | null;
  room?: Room;
  guest_name: string;
  guest_count: number;
  registration_date: string;
  registration_number?: string | null;
  drive_folder_id?: string | null;
  drive_folder_status: DriveFolderStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
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

export type StayExperienceStayType = "short_term" | "long_term";

export interface StayExperience {
  id: string;
  reservation_id: string;
  channel_id: string | null;
  external_ref_id: string | null;
  platform_reference: string | null;
  stay_type: StayExperienceStayType | null;
  experience_notes: string;
  guest_request_content: string;
  created_at: string;
  updated_at: string;
  reservation?: Reservation;
}

export interface StayExperienceCreateInput {
  reservation_id: string;
  channel_id?: string | null;
  external_ref_id?: string | null;
  platform_reference?: string | null;
  stay_type?: StayExperienceStayType | null;
  experience_notes?: string;
  guest_request_content?: string;
}

export interface StayExperienceUpdateInput extends Partial<StayExperienceCreateInput> {}

export type FolioStatus = "open" | "finalized" | "settled";
export type FolioLineItemKind = "charge" | "credit";

export interface FolioLineItem {
  id: string;
  folio_id: string;
  description: string;
  kind: FolioLineItemKind;
  quantity: number;
  unit_amount: number;
  line_total: number;
  tax_rate: number;
  source: string;
  created_at: string;
}

export interface FolioPayment {
  id: string;
  folio_id: string;
  method: string;
  amount: number;
  reference: string | null;
  received_at: string;
  created_at: string;
}

export interface Folio {
  id: string;
  reservation_id: string;
  property_id: string;
  status: FolioStatus;
  currency: string;
  subtotal_amount: number;
  paid_amount: number;
  balance_amount: number;
  opened_at: string;
  finalized_at: string | null;
  settled_at: string | null;
  line_items?: FolioLineItem[];
  payments?: FolioPayment[];
}

export interface FolioLineItemInput {
  description: string;
  kind: FolioLineItemKind;
  quantity: number;
  unit_amount: number;
  tax_rate?: number;
  source?: string;
}

export interface FolioPaymentInput {
  method: string;
  amount: number;
  reference?: string | null;
}

export interface CheckInOutResult {
  reservation: Reservation;
  folio: Folio;
}
