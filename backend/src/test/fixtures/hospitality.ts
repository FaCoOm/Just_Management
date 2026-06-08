import type { Prisma } from "@prisma/client";

export const FIXTURE_TODAY = "2026-06-08";
export const FIXTURE_TOMORROW = "2026-06-09";
export const FIXTURE_YESTERDAY = "2026-06-07";
export const FIXTURE_NOW = new Date("2026-06-08T02:00:00.000Z");

type Overrides<T> = Partial<T>;
type Defined<T> = Exclude<T, undefined>;
type WithRequired<T, K extends keyof T> = T & { [P in K]-?: Defined<T[P]> };

export type PropertyFixture = WithRequired<
  Prisma.propertiesUncheckedCreateInput,
  "id" | "name" | "slug" | "total_rooms" | "location" | "status" | "created_at"
>;

export type RoomFixture = WithRequired<
  Prisma.roomsUncheckedCreateInput,
  "id" | "property_id" | "room_number" | "room_name" | "room_type" | "status" | "passcode" | "floor" | "created_at"
>;

export type ReservationFixture = WithRequired<
  Prisma.reservationsUncheckedCreateInput,
  | "id"
  | "property_id"
  | "primary_room_id"
  | "status"
  | "check_in_date"
  | "check_out_date"
  | "guest_name"
  | "guest_phone"
  | "guest_email"
  | "adult_count"
  | "child_count"
  | "infant_count"
  | "guest_count"
  | "operational_notes"
  | "guest_notes"
  | "created_at"
  | "updated_at"
>;

export type GuestFixture = WithRequired<
  Prisma.guestsUncheckedCreateInput,
  | "id"
  | "property_id"
  | "room_id"
  | "guest_name"
  | "eta"
  | "etd"
  | "check_in_status"
  | "booking_source"
  | "is_vip"
  | "guest_count"
  | "created_at"
>;

export type MaintenanceIssueFixture = WithRequired<
  Prisma.maintenance_issuesUncheckedCreateInput,
  "id" | "property_id" | "room_id" | "title" | "description" | "severity" | "status" | "created_at"
>;

export type ChannelFixture = WithRequired<
  Prisma.channelsUncheckedCreateInput,
  "id" | "slug" | "display_name" | "status" | "created_at" | "updated_at"
>;

export type ExternalAccountFixture = WithRequired<
  Prisma.external_accountsUncheckedCreateInput,
  | "id"
  | "channel_id"
  | "account_key"
  | "display_name"
  | "status"
  | "archived_at"
  | "last_synced_at"
  | "last_sync_started_at"
  | "last_sync_error"
  | "sync_metadata"
  | "created_at"
  | "updated_at"
>;

export type ReservationExternalRefFixture = WithRequired<
  Prisma.reservation_external_refsUncheckedCreateInput,
  | "id"
  | "reservation_id"
  | "channel_id"
  | "external_account_id"
  | "channel_listing_id"
  | "provider_reservation_id"
  | "confirmation_code"
  | "raw_status"
  | "source_status"
  | "booked_at"
  | "source_created_at"
  | "source_updated_at"
  | "last_synced_at"
  | "payload_metadata"
  | "created_at"
  | "updated_at"
>;

export type ProviderReservationImportRowFixture = WithRequired<
  Prisma.provider_reservation_import_rowsUncheckedCreateInput,
  | "id"
  | "channel_id"
  | "external_account_id"
  | "source_file"
  | "source_row_number"
  | "provider_reservation_id"
  | "confirmation_code"
  | "raw_status"
  | "guest_name"
  | "guest_contact"
  | "adult_count"
  | "child_count"
  | "infant_count"
  | "guest_count"
  | "check_in_date"
  | "check_out_date"
  | "booked_at"
  | "provider_listing_id"
  | "listing_alias_value"
  | "raw_payload"
  | "resolved_channel_listing_id"
  | "resolution_status"
  | "resolution_method"
  | "resolution_notes"
  | "reservation_id"
  | "created_at"
  | "updated_at"
>;

export type TaxExportSettingsFixture = WithRequired<
  Prisma.tax_export_settingsUncheckedCreateInput,
  | "id"
  | "default_buyer_label"
  | "default_payment_method"
  | "default_unit"
  | "default_vat_rate"
  | "service_name_template"
  | "schedule_enabled"
  | "schedule_time"
  | "schedule_timezone"
  | "sheet_id"
  | "sheet_tab"
  | "template_columns"
  | "created_at"
  | "updated_at"
>;

export type TaxExportJobFixture = WithRequired<
  Prisma.tax_export_jobsUncheckedCreateInput,
  | "id"
  | "checkout_date"
  | "status"
  | "total_items"
  | "exported_count"
  | "failed_count"
  | "skipped_count"
  | "review_count"
  | "triggered_by"
  | "started_at"
  | "completed_at"
  | "error_message"
  | "created_at"
>;

export type TaxExportItemFixture = WithRequired<
  Prisma.tax_export_itemsUncheckedCreateInput,
  | "id"
  | "job_id"
  | "reservation_id"
  | "invoice_number"
  | "invoice_date"
  | "buyer_label"
  | "payment_method"
  | "service_description"
  | "unit"
  | "quantity"
  | "unit_price"
  | "total_amount"
  | "vat_rate"
  | "vat_amount"
  | "status"
  | "needs_review_reason"
  | "guest_name"
  | "property_name"
  | "check_in_date"
  | "check_out_date"
  | "confirmation_code"
  | "created_at"
>;

export interface TrackBRestProperty {
  id: string;
  name: string;
  slug: string;
  total_rooms: number;
  location: string;
  status: string;
  created_at: string;
}

export interface TrackBRestRoom {
  id: string;
  property_id: string;
  room_number: string;
  room_name: string;
  room_type: string;
  status: string;
  passcode: string;
  floor: number;
  created_at: string;
}

export interface TrackBRestReservation {
  id: string;
  property_id: string;
  primary_room_id: string | null;
  status: string;
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

export interface TrackBRestDashboardGuest {
  id: string;
  reservation_id: string;
  property_id: string;
  room_id: string | null;
  guest_name: string;
  eta: string | null;
  etd: string | null;
  check_in_status: string;
  booking_source: string;
  is_vip: boolean;
  guest_count: number;
  created_at: string;
}

export interface TrackBRestMaintenanceIssue {
  id: string;
  property_id: string;
  room_id: string | null;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
}

export interface TrackBRestExternalAccount {
  id: string;
  channel_id: string;
  account_key: string;
  display_name: string;
  status: string;
  archived_at: string | null;
  last_synced_at: string | null;
  last_sync_started_at: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackBRestChannel {
  id: string;
  slug: string;
  display_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  external_accounts: TrackBRestExternalAccount[];
}

export interface TaxExportItemPreviewFixture {
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

export interface HospitalityFixtureSet {
  properties: PropertyFixture[];
  rooms: RoomFixture[];
  reservations: ReservationFixture[];
  guests: GuestFixture[];
  maintenanceIssues: MaintenanceIssueFixture[];
  channels: ChannelFixture[];
  externalAccounts: ExternalAccountFixture[];
  reservationExternalRefs: ReservationExternalRefFixture[];
}

export interface TaxExportFixtureSet {
  settings: TaxExportSettingsFixture;
  job: TaxExportJobFixture;
  items: TaxExportItemFixture[];
  previewItems: TaxExportItemPreviewFixture[];
  providerImportRows: ProviderReservationImportRowFixture[];
  manualScopeKey: string;
  triggeredBy: string;
  sameDayCheckoutReservation: ReservationFixture;
  needsReviewReservation: ReservationFixture;
  ambiguousEmailReservation: ReservationFixture;
  confirmationRefs: ReservationExternalRefFixture[];
}

const ids = {
  propertyMujo: "00000000-0000-4000-8000-000000000101",
  propertyRuby: "00000000-0000-4000-8000-000000000102",
  roomMujo101: "00000000-0000-4000-8000-000000000201",
  roomMujo102: "00000000-0000-4000-8000-000000000202",
  roomRuby201: "00000000-0000-4000-8000-000000000203",
  reservationCheckout: "00000000-0000-4000-8000-000000000301",
  reservationReview: "00000000-0000-4000-8000-000000000302",
  reservationAmbiguousEmail: "00000000-0000-4000-8000-000000000303",
  guestCheckout: "00000000-0000-4000-8000-000000000401",
  guestReview: "00000000-0000-4000-8000-000000000402",
  guestAmbiguousEmail: "00000000-0000-4000-8000-000000000403",
  maintenanceOpen: "00000000-0000-4000-8000-000000000501",
  maintenanceResolved: "00000000-0000-4000-8000-000000000502",
  channelAirbnb: "00000000-0000-4000-8000-000000000601",
  channelBooking: "00000000-0000-4000-8000-000000000602",
  accountAirbnbMain: "00000000-0000-4000-8000-000000000701",
  accountBookingMain: "00000000-0000-4000-8000-000000000702",
  refCheckout: "00000000-0000-4000-8000-000000000801",
  refAmbiguousEmail: "00000000-0000-4000-8000-000000000802",
  providerRowCheckout: "00000000-0000-4000-8000-000000000901",
  providerRowAmbiguousEmail: "00000000-0000-4000-8000-000000000902",
  taxSettings: "00000000-0000-4000-8000-000000001001",
  taxJob: "00000000-0000-4000-8000-000000001101",
  taxItemCheckout: "00000000-0000-4000-8000-000000001201",
  taxItemReview: "00000000-0000-4000-8000-000000001202",
  taxItemAmbiguousEmail: "00000000-0000-4000-8000-000000001203",
};

function dateOnly(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function cloneDate(date: Date) {
  return new Date(date.toISOString());
}

function iso(date: Date | string | null | undefined) {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : date;
}

function timestamp(date: Date | string) {
  return date instanceof Date ? date.toISOString() : date;
}

function dateKey(date: Date | string) {
  return timestamp(date).slice(0, 10);
}

function restStatus(status: string) {
  switch (status) {
    case "check_in_pending":
      return "Check-In Pending";
    case "checked_in":
      return "Checked In";
    case "check_out_pending":
      return "Check-Out Pending";
    case "checked_out":
    case "cancelled":
    case "no_show":
      return "Checked Out";
    default:
      return "Pending";
  }
}

function bookingSource(notes: string) {
  return notes.match(/booking_source=([^;]+)/i)?.[1]?.trim() || "Reservation";
}

function manualScopeKey(checkoutDate: string, propertyId?: string, reservationId?: string) {
  return [
    `checkout=${checkoutDate}`,
    `property=${propertyId?.trim() || "all"}`,
    `reservation=${reservationId?.trim() || "all"}`,
  ].join("|");
}

export function makeProperty(overrides: Overrides<PropertyFixture> = {}): PropertyFixture {
  return {
    id: ids.propertyMujo,
    name: "Mujo Saigon",
    slug: "mujo-saigon",
    total_rooms: 2,
    location: "Ho Chi Minh City",
    status: "active",
    created_at: cloneDate(FIXTURE_NOW),
    ...overrides,
  };
}

export function makeRoom(overrides: Overrides<RoomFixture> = {}): RoomFixture {
  return {
    id: ids.roomMujo101,
    property_id: ids.propertyMujo,
    room_number: "101",
    room_name: "Deluxe King 101",
    room_type: "Deluxe King",
    status: "Check-Out Pending",
    passcode: "4101",
    floor: 1,
    created_at: cloneDate(FIXTURE_NOW),
    ...overrides,
  };
}

export function makeReservation(overrides: Overrides<ReservationFixture> = {}): ReservationFixture {
  return {
    id: ids.reservationCheckout,
    property_id: ids.propertyMujo,
    primary_room_id: ids.roomMujo101,
    status: "check_out_pending",
    check_in_date: dateOnly(FIXTURE_YESTERDAY),
    check_out_date: dateOnly(FIXTURE_TODAY),
    guest_name: "Alice Johnson",
    guest_phone: "+84 900000001",
    guest_email: "alice.johnson@example.com",
    adult_count: 2,
    child_count: 0,
    infant_count: 0,
    guest_count: 2,
    operational_notes: "booking_source=Airbnb;nightly_rate=1200000",
    guest_notes: "",
    created_at: cloneDate(FIXTURE_NOW),
    updated_at: cloneDate(FIXTURE_NOW),
    ...overrides,
  };
}

export function makeGuestFromReservation(
  reservation: ReservationFixture,
  overrides: Overrides<GuestFixture> = {}
): GuestFixture {
  return {
    id: ids.guestCheckout,
    property_id: reservation.property_id,
    room_id: reservation.primary_room_id,
    guest_name: reservation.guest_name,
    eta: reservation.check_in_date,
    etd: reservation.check_out_date,
    check_in_status: restStatus(reservation.status),
    booking_source: bookingSource(reservation.operational_notes),
    is_vip: /is_vip=true/i.test(reservation.operational_notes),
    guest_count: reservation.guest_count,
    created_at: cloneDate(FIXTURE_NOW),
    ...overrides,
  };
}

export function makeMaintenanceIssue(
  overrides: Overrides<MaintenanceIssueFixture> = {}
): MaintenanceIssueFixture {
  return {
    id: ids.maintenanceOpen,
    property_id: ids.propertyMujo,
    room_id: ids.roomMujo102,
    title: "AC not cooling",
    description: "Room AC unit blowing warm air",
    severity: "High",
    status: "Open",
    created_at: cloneDate(FIXTURE_NOW),
    ...overrides,
  };
}

export function makeChannel(overrides: Overrides<ChannelFixture> = {}): ChannelFixture {
  return {
    id: ids.channelAirbnb,
    slug: "airbnb",
    display_name: "Airbnb",
    status: "active",
    created_at: cloneDate(FIXTURE_NOW),
    updated_at: cloneDate(FIXTURE_NOW),
    ...overrides,
  };
}

export function makeExternalAccount(
  overrides: Overrides<ExternalAccountFixture> = {}
): ExternalAccountFixture {
  return {
    id: ids.accountAirbnbMain,
    channel_id: ids.channelAirbnb,
    account_key: "airbnb-main",
    display_name: "Airbnb Main",
    status: "active",
    archived_at: null,
    last_synced_at: null,
    last_sync_started_at: null,
    last_sync_error: null,
    sync_metadata: {},
    created_at: cloneDate(FIXTURE_NOW),
    updated_at: cloneDate(FIXTURE_NOW),
    ...overrides,
  };
}

export function makeReservationExternalRef(
  overrides: Overrides<ReservationExternalRefFixture> = {}
): ReservationExternalRefFixture {
  return {
    id: ids.refCheckout,
    reservation_id: ids.reservationCheckout,
    channel_id: ids.channelAirbnb,
    external_account_id: ids.accountAirbnbMain,
    channel_listing_id: null,
    provider_reservation_id: "AIRBNB-HM123ABC",
    confirmation_code: "HM123ABC",
    raw_status: "confirmed",
    source_status: "accepted",
    booked_at: new Date("2026-06-01T04:00:00.000Z"),
    source_created_at: new Date("2026-06-01T04:00:00.000Z"),
    source_updated_at: new Date("2026-06-02T04:00:00.000Z"),
    last_synced_at: cloneDate(FIXTURE_NOW),
    payload_metadata: {},
    created_at: cloneDate(FIXTURE_NOW),
    updated_at: cloneDate(FIXTURE_NOW),
    ...overrides,
  };
}

export function makeProviderReservationImportRow(
  overrides: Overrides<ProviderReservationImportRowFixture> = {}
): ProviderReservationImportRowFixture {
  return {
    id: ids.providerRowCheckout,
    channel_id: ids.channelAirbnb,
    external_account_id: ids.accountAirbnbMain,
    source_file: "airbnb-confirmations.csv",
    source_row_number: 1,
    provider_reservation_id: "AIRBNB-HM123ABC",
    confirmation_code: "HM123ABC",
    raw_status: "confirmed",
    guest_name: "Alice Johnson",
    guest_contact: "alice.johnson@example.com",
    adult_count: 2,
    child_count: 0,
    infant_count: 0,
    guest_count: 2,
    check_in_date: dateOnly(FIXTURE_YESTERDAY),
    check_out_date: dateOnly(FIXTURE_TODAY),
    booked_at: new Date("2026-06-01T04:00:00.000Z"),
    provider_listing_id: "mujo-saigon-101",
    listing_alias_value: "Mujo Saigon Deluxe 101",
    raw_payload: {},
    resolved_channel_listing_id: null,
    resolution_status: "pending",
    resolution_method: null,
    resolution_notes: "",
    reservation_id: ids.reservationCheckout,
    created_at: cloneDate(FIXTURE_NOW),
    updated_at: cloneDate(FIXTURE_NOW),
    ...overrides,
  };
}

export function makeTaxExportSettings(
  overrides: Overrides<TaxExportSettingsFixture> = {}
): TaxExportSettingsFixture {
  return {
    id: ids.taxSettings,
    default_buyer_label: "Khách lẻ không lấy hóa đơn",
    default_payment_method: "Chuyển khoản",
    default_unit: "Đêm",
    default_vat_rate: 8,
    service_name_template: "Dịch vụ thuê phòng ({check_in} - {check_out})",
    schedule_enabled: false,
    schedule_time: "18:00",
    schedule_timezone: "Asia/Ho_Chi_Minh",
    sheet_id: "fixture-sheet-id",
    sheet_tab: "Tax Export",
    template_columns: {
      invoice_number: "A",
      invoice_date: "B",
      buyer_label: "F",
      payment_method: "J",
      service_description: "K",
      unit: "L",
      quantity: "M",
      unit_price: "N",
      total_amount: "O",
      vat_rate: "P",
      vat_amount: "Q",
    },
    created_at: cloneDate(FIXTURE_NOW),
    updated_at: cloneDate(FIXTURE_NOW),
    ...overrides,
  };
}

export function makeTaxExportJob(overrides: Overrides<TaxExportJobFixture> = {}): TaxExportJobFixture {
  const defaultManualScopeKey = manualScopeKey(FIXTURE_TODAY, ids.propertyMujo);
  return {
    id: ids.taxJob,
    checkout_date: dateOnly(FIXTURE_TODAY),
    status: "completed",
    total_items: 3,
    exported_count: 2,
    failed_count: 0,
    skipped_count: 0,
    review_count: 1,
    triggered_by: `manual:${defaultManualScopeKey}`,
    started_at: cloneDate(FIXTURE_NOW),
    completed_at: cloneDate(FIXTURE_NOW),
    error_message: null,
    created_at: cloneDate(FIXTURE_NOW),
    ...overrides,
  };
}

export function makeTaxExportItem(overrides: Overrides<TaxExportItemFixture> = {}): TaxExportItemFixture {
  return {
    id: ids.taxItemCheckout,
    job_id: ids.taxJob,
    reservation_id: ids.reservationCheckout,
    invoice_number: "1",
    invoice_date: "08/06/2026",
    buyer_label: "Khách lẻ không lấy hóa đơn",
    payment_method: "Chuyển khoản",
    service_description: "Dịch vụ thuê phòng (07/06/2026 - 08/06/2026)",
    unit: "Đêm",
    quantity: 1,
    unit_price: 1200000,
    total_amount: 1200000,
    vat_rate: 8,
    vat_amount: 96000,
    status: "exported",
    needs_review_reason: null,
    guest_name: "Alice Johnson",
    property_name: "Mujo Saigon",
    check_in_date: FIXTURE_YESTERDAY,
    check_out_date: FIXTURE_TODAY,
    confirmation_code: "HM123ABC",
    created_at: cloneDate(FIXTURE_NOW),
    ...overrides,
  };
}

export function toRestProperty(property: PropertyFixture): TrackBRestProperty {
  return {
    id: property.id,
    name: property.name,
    slug: property.slug,
    total_rooms: property.total_rooms,
    location: property.location,
    status: property.status,
    created_at: timestamp(property.created_at),
  };
}

export function toRestRoom(room: RoomFixture): TrackBRestRoom {
  return {
    id: room.id,
    property_id: room.property_id,
    room_number: room.room_number,
    room_name: room.room_name,
    room_type: room.room_type,
    status: room.status,
    passcode: room.passcode,
    floor: room.floor,
    created_at: timestamp(room.created_at),
  };
}

export function toRestReservation(reservation: ReservationFixture): TrackBRestReservation {
  return {
    id: reservation.id,
    property_id: reservation.property_id,
    primary_room_id: reservation.primary_room_id,
    status: reservation.status,
    check_in_date: dateKey(reservation.check_in_date),
    check_out_date: dateKey(reservation.check_out_date),
    guest_name: reservation.guest_name,
    guest_phone: reservation.guest_phone ?? null,
    guest_email: reservation.guest_email ?? null,
    adult_count: reservation.adult_count,
    child_count: reservation.child_count,
    infant_count: reservation.infant_count,
    guest_count: reservation.guest_count,
    operational_notes: reservation.operational_notes,
    guest_notes: reservation.guest_notes,
    created_at: timestamp(reservation.created_at),
    updated_at: timestamp(reservation.updated_at),
  };
}

export function toDashboardGuest(reservation: ReservationFixture): TrackBRestDashboardGuest {
  return {
    id: reservation.id,
    reservation_id: reservation.id,
    property_id: reservation.property_id,
    room_id: reservation.primary_room_id,
    guest_name: reservation.guest_name,
    eta: dateKey(reservation.check_in_date),
    etd: dateKey(reservation.check_out_date),
    check_in_status: restStatus(reservation.status),
    booking_source: bookingSource(reservation.operational_notes),
    is_vip: /is_vip=true/i.test(reservation.operational_notes),
    guest_count: reservation.guest_count,
    created_at: timestamp(reservation.created_at),
  };
}

export function toRestMaintenanceIssue(issue: MaintenanceIssueFixture): TrackBRestMaintenanceIssue {
  return {
    id: issue.id,
    property_id: issue.property_id,
    room_id: issue.room_id,
    title: issue.title,
    description: issue.description,
    severity: issue.severity,
    status: issue.status,
    created_at: timestamp(issue.created_at),
  };
}

export function toRestExternalAccount(account: ExternalAccountFixture): TrackBRestExternalAccount {
  return {
    id: account.id,
    channel_id: account.channel_id,
    account_key: account.account_key,
    display_name: account.display_name,
    status: account.status,
    archived_at: iso(account.archived_at),
    last_synced_at: iso(account.last_synced_at),
    last_sync_started_at: iso(account.last_sync_started_at),
    last_sync_error: account.last_sync_error ?? null,
    created_at: timestamp(account.created_at),
    updated_at: timestamp(account.updated_at),
  };
}

export function toRestChannel(
  channel: ChannelFixture,
  accounts: ExternalAccountFixture[] = []
): TrackBRestChannel {
  return {
    id: channel.id,
    slug: channel.slug,
    display_name: channel.display_name,
    status: channel.status,
    created_at: timestamp(channel.created_at),
    updated_at: timestamp(channel.updated_at),
    external_accounts: accounts
      .filter((account) => account.channel_id === channel.id)
      .map(toRestExternalAccount),
  };
}

export function toTaxExportPreviewItem(item: TaxExportItemFixture): TaxExportItemPreviewFixture {
  return {
    invoice_number: item.invoice_number,
    invoice_date: item.invoice_date,
    buyer_label: item.buyer_label,
    payment_method: item.payment_method,
    service_description: item.service_description,
    unit: item.unit,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_amount: item.total_amount,
    vat_rate: item.vat_rate,
    vat_amount: item.vat_amount,
    guest_name: item.guest_name,
    property_name: item.property_name,
    check_in_date: item.check_in_date,
    check_out_date: item.check_out_date,
    reservation_id: item.reservation_id,
    confirmation_code: item.confirmation_code ?? null,
    status: item.status,
    needs_review_reason: item.needs_review_reason ?? null,
  };
}

export function createHospitalityFixtureSet(): HospitalityFixtureSet {
  const properties = [
    makeProperty(),
    makeProperty({
      id: ids.propertyRuby,
      name: "Ruby Da Nang",
      slug: "ruby-danang",
      total_rooms: 1,
      location: "Da Nang",
    }),
  ];

  const rooms = [
    makeRoom(),
    makeRoom({
      id: ids.roomMujo102,
      room_number: "102",
      room_name: "Superior Twin 102",
      room_type: "Superior Twin",
      status: "Vacant",
      passcode: "4102",
    }),
    makeRoom({
      id: ids.roomRuby201,
      property_id: ids.propertyRuby,
      room_number: "201",
      room_name: "Standard Double 201",
      room_type: "Standard Double",
      status: "Occupied",
      passcode: "4201",
      floor: 2,
    }),
  ];

  const sameDayCheckoutReservation = makeReservation();
  const needsReviewReservation = makeReservation({
    id: ids.reservationReview,
    primary_room_id: ids.roomMujo102,
    guest_name: "Binh Tran",
    guest_phone: "+84 900000002",
    guest_email: null,
    operational_notes: "booking_source=Direct",
  });
  const ambiguousEmailReservation = makeReservation({
    id: ids.reservationAmbiguousEmail,
    property_id: ids.propertyRuby,
    primary_room_id: ids.roomRuby201,
    guest_name: "Cam Ly",
    guest_phone: null,
    guest_email: "reservations@example.com",
    operational_notes: "booking_source=Booking.com;nightly_rate=900000;source_email=ambiguous",
  });
  const reservations = [sameDayCheckoutReservation, needsReviewReservation, ambiguousEmailReservation];

  const guests = [
    makeGuestFromReservation(sameDayCheckoutReservation),
    makeGuestFromReservation(needsReviewReservation, { id: ids.guestReview }),
    makeGuestFromReservation(ambiguousEmailReservation, { id: ids.guestAmbiguousEmail }),
  ];

  const maintenanceIssues = [
    makeMaintenanceIssue(),
    makeMaintenanceIssue({
      id: ids.maintenanceResolved,
      room_id: ids.roomRuby201,
      property_id: ids.propertyRuby,
      title: "Light bulb out",
      description: "Bedside lamp not working",
      severity: "Low",
      status: "Resolved",
    }),
  ];

  const channels = [
    makeChannel(),
    makeChannel({
      id: ids.channelBooking,
      slug: "booking-com",
      display_name: "Booking.com",
    }),
  ];

  const externalAccounts = [
    makeExternalAccount(),
    makeExternalAccount({
      id: ids.accountBookingMain,
      channel_id: ids.channelBooking,
      account_key: "booking-main",
      display_name: "Booking.com Main",
    }),
  ];

  const reservationExternalRefs = [
    makeReservationExternalRef(),
    makeReservationExternalRef({
      id: ids.refAmbiguousEmail,
      reservation_id: ids.reservationAmbiguousEmail,
      channel_id: ids.channelBooking,
      external_account_id: ids.accountBookingMain,
      provider_reservation_id: "BK-998877",
      confirmation_code: "998877",
      raw_status: "ok",
      source_status: "confirmed",
      payload_metadata: { email_match: "ambiguous" },
    }),
  ];

  return {
    properties,
    rooms,
    reservations,
    guests,
    maintenanceIssues,
    channels,
    externalAccounts,
    reservationExternalRefs,
  };
}

export function createTaxExportFixtureSet(): TaxExportFixtureSet {
  const hospitality = createHospitalityFixtureSet();
  const [sameDayCheckoutReservation, needsReviewReservation, ambiguousEmailReservation] = hospitality.reservations;
  const [confirmationRef, ambiguousEmailRef] = hospitality.reservationExternalRefs;
  const scopeKey = manualScopeKey(FIXTURE_TODAY, ids.propertyMujo);
  const triggeredBy = `manual:${scopeKey}`;
  const job = makeTaxExportJob({ triggered_by: triggeredBy });

  const items = [
    makeTaxExportItem(),
    makeTaxExportItem({
      id: ids.taxItemReview,
      reservation_id: ids.reservationReview,
      invoice_number: "2",
      unit_price: 0,
      total_amount: 0,
      vat_amount: 0,
      status: "needs_review",
      needs_review_reason: "Unit price not found in reservation data",
      guest_name: needsReviewReservation.guest_name,
      confirmation_code: null,
    }),
    makeTaxExportItem({
      id: ids.taxItemAmbiguousEmail,
      reservation_id: ids.reservationAmbiguousEmail,
      invoice_number: "3",
      unit_price: 900000,
      total_amount: 900000,
      vat_amount: 72000,
      guest_name: ambiguousEmailReservation.guest_name,
      property_name: "Ruby Da Nang",
      confirmation_code: ambiguousEmailRef.confirmation_code,
    }),
  ];

  const providerImportRows = [
    makeProviderReservationImportRow(),
    makeProviderReservationImportRow({
      id: ids.providerRowAmbiguousEmail,
      channel_id: ids.channelBooking,
      external_account_id: ids.accountBookingMain,
      source_file: "booking-email-import.csv",
      source_row_number: 2,
      provider_reservation_id: "BK-998877",
      confirmation_code: "998877",
      guest_name: ambiguousEmailReservation.guest_name,
      guest_contact: "reservations@example.com; cam.ly@example.com",
      provider_listing_id: "ruby-da-nang-201",
      listing_alias_value: "Ruby Da Nang Standard 201",
      reservation_id: ids.reservationAmbiguousEmail,
      raw_payload: { email_match: "ambiguous", matched_candidates: 2 },
    }),
  ];

  return {
    settings: makeTaxExportSettings(),
    job,
    items,
    previewItems: items.map(toTaxExportPreviewItem),
    providerImportRows,
    manualScopeKey: scopeKey,
    triggeredBy,
    sameDayCheckoutReservation,
    needsReviewReservation,
    ambiguousEmailReservation,
    confirmationRefs: [confirmationRef, ambiguousEmailRef],
  };
}

export const fixtureIds = ids;
