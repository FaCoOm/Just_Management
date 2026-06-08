import type {
  Guest,
  MaintenanceIssue,
  Property,
  Reservation,
  Room,
} from "@/types/database";

export const FIXTURE_TODAY = "2026-06-08";
export const FIXTURE_TOMORROW = "2026-06-09";
export const FIXTURE_YESTERDAY = "2026-06-07";
export const FIXTURE_NOW = "2026-06-08T02:00:00.000Z";

type Overrides<T> = Partial<T>;

export interface ExternalAccountFixture {
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

export interface ChannelFixture {
  id: string;
  slug: string;
  display_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  external_accounts: ExternalAccountFixture[];
}

export interface TaxExportItemFixture {
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

export interface TaxExportJobFixture {
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

export interface TaxExportReviewItemFixture {
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

export interface TaxSettingsFixture {
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

export interface HospitalityFixtureSet {
  properties: Property[];
  rooms: Room[];
  reservations: Reservation[];
  guests: Guest[];
  maintenance: MaintenanceIssue[];
  channels: ChannelFixture[];
  externalAccounts: ExternalAccountFixture[];
}

export interface TaxExportFixtureSet {
  settings: TaxSettingsFixture;
  items: TaxExportItemFixture[];
  jobs: TaxExportJobFixture[];
  reviewItems: TaxExportReviewItemFixture[];
  manualScopeKey: string;
  triggeredBy: string;
  sameDayCheckoutReservation: Reservation;
  needsReviewReservation: Reservation;
  ambiguousEmailReservation: Reservation;
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
  channelAirbnb: "00000000-0000-4000-8000-000000000601",
  channelBooking: "00000000-0000-4000-8000-000000000602",
  accountAirbnbMain: "00000000-0000-4000-8000-000000000701",
  accountBookingMain: "00000000-0000-4000-8000-000000000702",
  taxJob: "00000000-0000-4000-8000-000000001101",
};

function withDateTime(dateKey: string) {
  return `${dateKey}T00:00:00`;
}

function bookingSource(notes: string) {
  return notes.match(/booking_source=([^;]+)/i)?.[1]?.trim() || "Reservation";
}

function dashboardStatus(status: Reservation["status"]): Guest["check_in_status"] {
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

function manualScopeKey(checkoutDate: string, propertyId?: string, reservationId?: string) {
  return [
    `checkout=${checkoutDate}`,
    `property=${propertyId?.trim() || "all"}`,
    `reservation=${reservationId?.trim() || "all"}`,
  ].join("|");
}

export function makeProperty(overrides: Overrides<Property> = {}): Property {
  return {
    id: ids.propertyMujo,
    name: "Mujo Saigon",
    slug: "mujo-saigon",
    total_rooms: 2,
    location: "Ho Chi Minh City",
    status: "active",
    created_at: FIXTURE_NOW,
    ...overrides,
  };
}

export function makeRoom(overrides: Overrides<Room> = {}): Room {
  return {
    id: ids.roomMujo101,
    property_id: ids.propertyMujo,
    room_number: "101",
    room_name: "Deluxe King 101",
    room_type: "Deluxe King",
    status: "Check-Out Pending",
    passcode: "4101",
    floor: 1,
    created_at: FIXTURE_NOW,
    ...overrides,
  };
}

export function makeReservation(overrides: Overrides<Reservation> = {}): Reservation {
  return {
    id: ids.reservationCheckout,
    property_id: ids.propertyMujo,
    primary_room_id: ids.roomMujo101,
    status: "check_out_pending",
    check_in_date: FIXTURE_YESTERDAY,
    check_out_date: FIXTURE_TODAY,
    guest_name: "Alice Johnson",
    guest_phone: "+84 900000001",
    guest_email: "alice.johnson@example.com",
    adult_count: 2,
    child_count: 0,
    infant_count: 0,
    guest_count: 2,
    operational_notes: "booking_source=Airbnb;nightly_rate=1200000",
    guest_notes: "",
    created_at: FIXTURE_NOW,
    updated_at: FIXTURE_NOW,
    ...overrides,
  };
}

export function makeGuestFromReservation(
  reservation: Reservation,
  overrides: Overrides<Guest> = {}
): Guest {
  return {
    id: reservation.id,
    reservation_id: reservation.id,
    property_id: reservation.property_id,
    room_id: reservation.primary_room_id,
    guest_name: reservation.guest_name,
    eta: withDateTime(reservation.check_in_date),
    etd: withDateTime(reservation.check_out_date),
    check_in_status: dashboardStatus(reservation.status),
    booking_source: bookingSource(reservation.operational_notes),
    is_vip: /is_vip=true/i.test(reservation.operational_notes),
    guest_count: reservation.guest_count,
    created_at: reservation.created_at,
    ...overrides,
  };
}

export function makeMaintenanceIssue(
  overrides: Overrides<MaintenanceIssue> = {}
): MaintenanceIssue {
  return {
    id: "00000000-0000-4000-8000-000000000501",
    property_id: ids.propertyMujo,
    room_id: ids.roomMujo102,
    title: "AC not cooling",
    description: "Room AC unit blowing warm air",
    severity: "High",
    status: "Open",
    created_at: FIXTURE_NOW,
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
    created_at: FIXTURE_NOW,
    updated_at: FIXTURE_NOW,
    ...overrides,
  };
}

export function makeChannel(
  overrides: Overrides<Omit<ChannelFixture, "external_accounts">> = {},
  accounts: ExternalAccountFixture[] = []
): ChannelFixture {
  const channel = {
    id: ids.channelAirbnb,
    slug: "airbnb",
    display_name: "Airbnb",
    status: "active",
    created_at: FIXTURE_NOW,
    updated_at: FIXTURE_NOW,
    ...overrides,
  };

  return {
    ...channel,
    external_accounts: accounts.filter((account) => account.channel_id === channel.id),
  };
}

export function makeTaxSettings(overrides: Overrides<TaxSettingsFixture> = {}): TaxSettingsFixture {
  return {
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
    ...overrides,
  };
}

export function makeTaxExportItem(overrides: Overrides<TaxExportItemFixture> = {}): TaxExportItemFixture {
  return {
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
    guest_name: "Alice Johnson",
    property_name: "Mujo Saigon",
    check_in_date: FIXTURE_YESTERDAY,
    check_out_date: FIXTURE_TODAY,
    reservation_id: ids.reservationCheckout,
    confirmation_code: "HM123ABC",
    status: "exported",
    needs_review_reason: null,
    ...overrides,
  };
}

export function makeTaxExportJob(
  items: TaxExportItemFixture[] = [makeTaxExportItem()],
  overrides: Overrides<TaxExportJobFixture> = {}
): TaxExportJobFixture {
  const reviewCount = items.filter((item) => item.status === "needs_review").length;
  return {
    id: ids.taxJob,
    checkout_date: FIXTURE_TODAY,
    status: "completed",
    total_items: items.length,
    exported_count: items.length - reviewCount,
    failed_count: 0,
    review_count: reviewCount,
    triggered_by: `manual:${manualScopeKey(FIXTURE_TODAY, ids.propertyMujo)}`,
    created_at: FIXTURE_NOW,
    completed_at: FIXTURE_NOW,
    items: items.map((item, index) => ({
      id: `00000000-0000-4000-8000-00000000120${index + 1}`,
      status: item.status,
      guest_name: item.guest_name,
      invoice_number: item.invoice_number,
      total_amount: item.total_amount,
      needs_review_reason: item.needs_review_reason,
    })),
    ...overrides,
  };
}

export function toReviewItem(
  item: TaxExportItemFixture,
  overrides: Overrides<TaxExportReviewItemFixture> = {}
): TaxExportReviewItemFixture {
  return {
    id: `review-${item.reservation_id}`,
    invoice_number: item.invoice_number,
    guest_name: item.guest_name,
    property_name: item.property_name,
    service_description: item.service_description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_amount: item.total_amount,
    vat_rate: item.vat_rate,
    vat_amount: item.vat_amount,
    status: item.status,
    needs_review_reason: item.needs_review_reason,
    ...overrides,
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
    makeRoom({ id: ids.roomMujo102, room_number: "102", room_name: "Superior Twin 102", status: "Vacant" }),
    makeRoom({
      id: ids.roomRuby201,
      property_id: ids.propertyRuby,
      room_number: "201",
      room_name: "Standard Double 201",
      room_type: "Standard Double",
      status: "Occupied",
    }),
  ];
  const reservations = [
    makeReservation(),
    makeReservation({
      id: ids.reservationReview,
      primary_room_id: ids.roomMujo102,
      guest_name: "Binh Tran",
      guest_email: null,
      operational_notes: "booking_source=Direct",
    }),
    makeReservation({
      id: ids.reservationAmbiguousEmail,
      property_id: ids.propertyRuby,
      primary_room_id: ids.roomRuby201,
      guest_name: "Cam Ly",
      guest_phone: null,
      guest_email: "reservations@example.com",
      operational_notes: "booking_source=Booking.com;nightly_rate=900000;source_email=ambiguous",
    }),
  ];
  const guests = reservations.map((reservation) => makeGuestFromReservation(reservation));
  const maintenance = [
    makeMaintenanceIssue(),
    makeMaintenanceIssue({
      id: "00000000-0000-4000-8000-000000000502",
      property_id: ids.propertyRuby,
      room_id: ids.roomRuby201,
      title: "Light bulb out",
      severity: "Low",
      status: "Resolved",
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
  const channels = [
    makeChannel({}, externalAccounts),
    makeChannel({ id: ids.channelBooking, slug: "booking-com", display_name: "Booking.com" }, externalAccounts),
  ];

  return { properties, rooms, reservations, guests, maintenance, channels, externalAccounts };
}

export function createTaxExportFixtureSet(): TaxExportFixtureSet {
  const hospitality = createHospitalityFixtureSet();
  const sameDayCheckoutReservation = hospitality.reservations[0];
  const needsReviewReservation = hospitality.reservations[1];
  const ambiguousEmailReservation = hospitality.reservations[2];
  if (!sameDayCheckoutReservation || !needsReviewReservation || !ambiguousEmailReservation) {
    throw new Error("Tax export fixture reservations missing");
  }

  const items = [
    makeTaxExportItem(),
    makeTaxExportItem({
      invoice_number: "2",
      reservation_id: needsReviewReservation.id,
      unit_price: 0,
      total_amount: 0,
      vat_amount: 0,
      guest_name: needsReviewReservation.guest_name,
      confirmation_code: null,
      status: "needs_review",
      needs_review_reason: "Unit price not found in reservation data",
    }),
    makeTaxExportItem({
      invoice_number: "3",
      reservation_id: ambiguousEmailReservation.id,
      unit_price: 900000,
      total_amount: 900000,
      vat_amount: 72000,
      guest_name: ambiguousEmailReservation.guest_name,
      property_name: "Ruby Da Nang",
      confirmation_code: "998877",
    }),
  ];
  const manualScope = manualScopeKey(FIXTURE_TODAY, ids.propertyMujo);

  return {
    settings: makeTaxSettings(),
    items,
    jobs: [makeTaxExportJob(items)],
    reviewItems: items
      .filter((item) => item.status === "needs_review")
      .map((item) => toReviewItem(item)),
    manualScopeKey: manualScope,
    triggeredBy: `manual:${manualScope}`,
    sameDayCheckoutReservation,
    needsReviewReservation,
    ambiguousEmailReservation,
  };
}

export const fixtureIds = ids;
