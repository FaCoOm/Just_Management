/**
 * Repository types for the Track B REST/Prisma abstraction.
 */

import type {
  Guest,
  Property,
  PropertyMetrics,
  Room,
  GuestRequest,
  MaintenanceIssue,
  OccupancySeriesPoint,
  Reservation,
  ReservationCreateInput,
  ReservationStatus,
} from "@/types/database";

export interface MaintenanceCreateInput {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "critical";
  property_id: string;
  room_id?: string | null;
}

export interface ExternalAccount {
  id: string;
  channel_id: string;
  account_key: string;
  display_name: string;
  status: string;
  archived_at?: string | null;
  last_synced_at: string | null;
  last_sync_started_at?: string | null;
  last_sync_error: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Channel {
  id: string;
  slug: string;
  display_name: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  external_accounts: ExternalAccount[];
}

export type DiningEventType = "dinner" | "event" | "meeting" | "celebration";
export type DiningEventStatus = "confirmed" | "pending" | "cancelled";

export interface DiningEventBooking {
  id: string;
  title: string;
  type: DiningEventType;
  venue: string;
  date: string;
  start_time: string;
  end_time: string;
  guest_count: number;
  guest_name: string;
  property_id: string;
  status: DiningEventStatus;
  notes: string;
}

export type StaffRole = "admin" | "manager" | "accountant" | "staff";
export type StaffStatus = "active" | "inactive";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  property_ids: string[];
  status: StaffStatus;
  last_active_at: string | null;
}

export type AuditSeverity = "info" | "warning" | "critical";

export interface SecurityAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  resource: string;
  details: string;
  severity: AuditSeverity;
}

export interface RoomRate {
  id: string;
  property_id: string | null;
  room_type: string;
  date: string;
  base_rate_vnd: number;
  rate_vnd: number;
}

export interface IngestError {
  code: string;
  field?: string;
  message: string;
}

export interface IngestSummaryResponse {
  syncRunId: string;
  dryRun: boolean;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  deadLetters: number;
  errors: IngestError[];
}

export interface ConnectorStatus {
  mode: "admin-upload" | "folder-watch" | "email" | "built-in" | "google-sheets";
  enabled: boolean;
  state: "ready" | "not_configured" | "planned" | "missing_path";
  detail: string;
  path?: string;
}

export interface GoogleCredentialStatus {
  configured: boolean;
  envVar?: "GOOGLE_SERVICE_ACCOUNT_FILE" | "GOOGLE_APPLICATION_CREDENTIALS";
  readable: boolean;
  path?: string;
  clientEmail?: string;
  projectId?: string;
  credentialType?: string;
}

export interface PipelineStatus {
  enabled: boolean;
  phase: "scaffolded";
  connectors: ConnectorStatus[];
  googleCredentials: GoogleCredentialStatus;
}

export interface TaxExportItemPreview {
  invoice_number: string;
  invoice_date: string;
  buyer_label: string;
  payment_method: string;
  service_description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  vat_rate: number;
  vat_amount: number;
  guest_name: string;
  property_name: string;
  check_in_date: string;
  check_out_date: string;
  reservation_id: string;
  confirmation_code: string | null;
  status: string;
  needs_review_reason: string | null;
}

export interface TaxExportSettings {
  default_buyer_label: string;
  default_payment_method: string;
  default_unit: string;
  default_vat_rate: number;
  service_name_template: string;
  schedule_enabled: boolean;
  schedule_time: string;
  schedule_timezone: string;
  sheet_id: string;
  sheet_tab: string;
  template_columns: Record<string, string>;
}

export interface TaxExportJobSummary {
  id: string;
  checkout_date: string;
  status: string;
  total_items: number;
  exported_count: number;
  failed_count: number;
  review_count: number;
  triggered_by: string;
  created_at: string;
  completed_at: string | null;
  items: Array<{
    id: string;
    status: string;
    guest_name: string;
    invoice_number: string;
    total_amount: number;
    needs_review_reason: string | null;
  }>;
}

export interface TaxExportJobDetails extends Omit<TaxExportJobSummary, "items"> {
  items: TaxExportReviewItem[];
}

export interface TaxExportReviewItem {
  id: string;
  invoice_number: string;
  guest_name: string;
  property_name: string;
  service_description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  vat_rate: number;
  vat_amount: number;
  status: string;
  needs_review_reason: string | null;
}

export interface TaxExportPreviewResponse {
  checkoutDate: string;
  items: TaxExportItemPreview[];
}

export interface TaxExportRunResponse {
  jobId?: string;
  runStatus?: string;
  createdNewJob?: boolean;
}

export interface TaxExportRepository {
  getPreview(date: string): Promise<TaxExportPreviewResponse>;
  getJobs(): Promise<TaxExportJobSummary[]>;
  getSettings(): Promise<TaxExportSettings>;
  getJob(jobId: string): Promise<TaxExportJobDetails>;
  patchItem(id: string, body: { status?: string; unit_price?: number; needs_review_reason?: null }): Promise<unknown>;
  run(body: { date: string; reservation_id?: string }): Promise<TaxExportRunResponse>;
  updateSettings(settings: Partial<TaxExportSettings> & { template_columns?: Record<string, string> }): Promise<TaxExportSettings>;
  getDownloadUrl(params: { jobId?: string; date?: string }): string;
}

export interface ChannelRepository {
  getAll(): Promise<Channel[]>;
}

export interface DiningEventRepository {
  getAll(): Promise<DiningEventBooking[]>;
  getByPropertyId(propertyId: string): Promise<DiningEventBooking[]>;
}

export interface StaffRepository {
  getAll(): Promise<StaffMember[]>;
}

export interface SecurityAuditRepository {
  getAll(): Promise<SecurityAuditEntry[]>;
}

export interface RateRepository {
  getByDateRange(startDate: string, endDate: string, propertyId?: string): Promise<RoomRate[]>;
}

export interface IntegrationStatus {
  status: "connected" | "disconnected";
  provider: "withone";
  error?: string;
}

export interface IntegrationConnection {
  id: string;
  user_id: string;
  platform: string;
  connection_key: string;
  display_name: string | null;
  environment: string;
  status: string;
  last_used_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationRepository {
  getStatus(): Promise<IntegrationStatus>;
  getConnections(): Promise<IntegrationConnection[]>;
  persistConnection(payload: { platform: string; connectionKey: string; displayName?: string }): Promise<unknown>;
  disconnect(connectionKey: string): Promise<unknown>;
}

export interface IngestRepository {
  getPipelineStatus(): Promise<PipelineStatus>;
  runBuiltInListingsSync(): Promise<IngestSummaryResponse>;
  uploadReservations(formData: FormData): Promise<IngestSummaryResponse>;
}

// Base repository interface all implementations must satisfy
export interface Repository<T> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
}

// Property repository
export interface PropertyRepository extends Repository<Property> {}

// Room repository
export interface RoomRepository extends Repository<Room> {
  getByPropertyId(propertyId: string): Promise<Room[]>;
}

// Reservation repository
export interface ReservationRepository extends Repository<Reservation> {
  create(input: ReservationCreateInput): Promise<Reservation>;
  getByPropertyId(propertyId: string): Promise<Reservation[]>;
  getByDateRange(startDate: string, endDate: string): Promise<Reservation[]>;
  getByStatus(statuses: ReservationStatus[]): Promise<Reservation[]>;
  getByCheckInDate(date: string): Promise<Reservation[]>;
  getByCheckOutDate(date: string): Promise<Reservation[]>;
}

// Guest request repository
export interface GuestRequestRepository extends Repository<GuestRequest> {
  getByPropertyId(propertyId: string): Promise<GuestRequest[]>;
}

// Maintenance issue repository
export interface MaintenanceRepository extends Repository<MaintenanceIssue> {
  create(input: MaintenanceCreateInput): Promise<MaintenanceIssue>;
  getByPropertyId(propertyId: string): Promise<MaintenanceIssue[]>;
  getOpenIssues(): Promise<MaintenanceIssue[]>;
}

export interface StatsRepository {
  getOccupancy(
    days: number,
    endDate: string,
    propertyId?: string
  ): Promise<OccupancySeriesPoint[]>;
}

export interface DashboardSummary {
  properties: Property[];
  rooms: Room[];
  reservations: Reservation[];
  guests: Guest[];
  requests: GuestRequest[];
  maintenance: MaintenanceIssue[];
  metrics: PropertyMetrics[];
  todayArrivals: Guest[];
  todayDepartures: Guest[];
  todayCheckouts: Guest[];
  totals: {
    arrivals: number;
    departures: number;
    occupancyRate: number;
    maintenanceOpen: number;
  };
  occupancySeries: OccupancySeriesPoint[];
}

export interface DashboardRepository {
  getSummary(date: string, days?: number, propertyId?: string): Promise<DashboardSummary>;
}

// Repository factory - Track B uses the REST API backend
export interface RepositoryFactory {
  dashboard: DashboardRepository;
  properties: PropertyRepository;
  rooms: RoomRepository;
  reservations: ReservationRepository;
  guestRequests: GuestRequestRepository;
  maintenance: MaintenanceRepository;
  stats: StatsRepository;
  channels: ChannelRepository;
  taxExport: TaxExportRepository;
  integrations: IntegrationRepository;
  ingest: IngestRepository;
  diningEvents: DiningEventRepository;
  staff: StaffRepository;
  securityAudit: SecurityAuditRepository;
  rates: RateRepository;
}
