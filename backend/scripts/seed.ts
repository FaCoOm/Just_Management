/**
 * Seed script: creates properties, rooms, reservations, guests, maintenance issues, channels, etc.
 * Run with: npx tsx scripts/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function uuid() {
  return crypto.randomUUID();
}

function daysFromNow(d: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + d);
  return new Date(date.toISOString().slice(0, 10) + "T00:00:00.000Z");
}

const today = daysFromNow(0);

async function main() {
  console.log("Seeding database...");

  // Properties
  const props = [
    { id: uuid(), name: "Mujo Saigon", slug: "mujo-saigon", total_rooms: 12, location: "Ho Chi Minh City", status: "active" },
    { id: uuid(), name: "Ruby Da Nang", slug: "ruby-danang", total_rooms: 8, location: "Da Nang", status: "active" },
    { id: uuid(), name: "Manuka Hoi An", slug: "manuka-hoian", total_rooms: 10, location: "Hoi An", status: "active" },
    { id: uuid(), name: "Latte Lounge HCMC", slug: "latte-hcmc", total_rooms: 6, location: "Ho Chi Minh City", status: "active" },
    { id: uuid(), name: "Jade Nha Trang", slug: "jade-nhatrang", total_rooms: 14, location: "Nha Trang", status: "active" },
    { id: uuid(), name: "Bamboo Phu Quoc", slug: "bamboo-phuquoc", total_rooms: 9, location: "Phu Quoc", status: "active" },
    { id: uuid(), name: "Orchid Hanoi", slug: "orchid-hanoi", total_rooms: 11, location: "Hanoi", status: "active" },
    { id: uuid(), name: "Silk Dalat", slug: "silk-dalat", total_rooms: 7, location: "Da Lat", status: "active" },
  ];

  for (const p of props) {
    await prisma.properties.upsert({ where: { slug: p.slug }, update: p, create: p });
  }

  const roomTypes = ["Deluxe King", "Superior Twin", "Standard Double", "Suite", "Family Room", "Studio"];
  const statuses = ["Vacant", "Occupied", "Checked In", "Check-In Pending", "Check-Out Pending", "Needs Attention"];
  const roomRecords: { id: string; property_id: string; room_number: string; room_name: string; room_type: string; status: string; floor: number; passcode: string }[] = [];

  for (const prop of props) {
    for (let i = 1; i <= prop.total_rooms; i++) {
      const floor = Math.ceil(i / 4);
      const roomNum = `${floor}0${i % 4 === 0 ? 4 : i % 4}`;
      const roomType = roomTypes[i % roomTypes.length];
      const status = i <= 3 ? "Occupied" : i <= 5 ? "Checked In" : i <= 6 ? "Check-In Pending" : i <= 7 ? "Check-Out Pending" : "Vacant";
      roomRecords.push({
        id: uuid(),
        property_id: prop.id,
        room_number: roomNum,
        room_name: `${roomType} ${roomNum}`,
        room_type: roomType,
        status,
        floor,
        passcode: String(1000 + i),
      });
    }
  }

  await prisma.rooms.createMany({ data: roomRecords, skipDuplicates: true });

  // Reservations
  const bookingSources = ["Airbnb", "Booking.com", "Agoda", "Direct", "Expedia"];
  const guestNames = [
    "Alice Johnson", "Bob Chen", "Charlie Kim", "Diana Nguyen", "Erik Müller",
    "Fatima Al-Hassan", "George Tanaka", "Hana Park", "Ivan Petrov", "Julia Santos",
    "Karl Johansson", "Lily Wang", "Marco Rossi", "Nadia Kovalenko", "Oscar Lim",
    "Priya Sharma", "Quinn O'Brien", "Rosa Garcia", "Stefan Weber", "Tanya Ivanova",
  ];

  const reservationRecords: any[] = [];
  let gIdx = 0;

  for (const prop of props) {
    const propRooms = roomRecords.filter(r => r.property_id === prop.id);
    for (let i = 0; i < Math.min(propRooms.length, 8); i++) {
      const room = propRooms[i];
      const guest = guestNames[gIdx % guestNames.length];
      const source = bookingSources[gIdx % bookingSources.length];
      const isVip = gIdx % 5 === 0;
      const checkInOffset = i <= 2 ? -2 : i <= 4 ? 0 : i <= 5 ? -1 : 1;
      const checkOutOffset = checkInOffset + (i <= 2 ? 4 : 3);
      const rStatus = i <= 2 ? "checked_in" : i <= 4 ? "check_in_pending" : i <= 5 ? "check_out_pending" : "pending";

      reservationRecords.push({
        id: uuid(),
        property_id: prop.id,
        primary_room_id: room.id,
        status: rStatus,
        check_in_date: daysFromNow(checkInOffset),
        check_out_date: daysFromNow(checkOutOffset),
        guest_name: guest,
        guest_phone: `+84 ${900000000 + gIdx}`,
        guest_email: `${guest.toLowerCase().replace(" ", ".")}@example.com`,
        adult_count: 1 + (gIdx % 2),
        child_count: gIdx % 3 === 0 ? 1 : 0,
        infant_count: 0,
        guest_count: 1 + (gIdx % 2) + (gIdx % 3 === 0 ? 1 : 0),
        operational_notes: `booking_source=${source}${isVip ? ";is_vip=true" : ""}`,
        guest_notes: isVip ? "VIP - returning guest" : "",
      });
      gIdx++;
    }
  }

  await prisma.reservations.createMany({ data: reservationRecords, skipDuplicates: true });

  // Maintenance issues
  const maintenanceItems = [
    { title: "AC not cooling", description: "Room AC unit blowing warm air", severity: "High" },
    { title: "Leaky faucet", description: "Bathroom faucet dripping constantly", severity: "Medium" },
    { title: "WiFi down", description: "No internet in floor 2", severity: "Critical" },
    { title: "Light bulb out", description: "Bedside lamp not working", severity: "Low" },
    { title: "Door lock jammed", description: "Room door smart lock not responding", severity: "High" },
    { title: "Toilet running", description: "Toilet constantly running water", severity: "Medium" },
  ];
  const mStatuses = ["Open", "In Progress", "Resolved"];

  const maintenanceRecords: any[] = [];
  for (const prop of props.slice(0, 5)) {
    const propRooms = roomRecords.filter(r => r.property_id === prop.id);
    for (let i = 0; i < 3; i++) {
      const item = maintenanceItems[i % maintenanceItems.length];
      maintenanceRecords.push({
        id: uuid(),
        property_id: prop.id,
        room_id: propRooms[i]?.id ?? null,
        title: item.title,
        description: item.description,
        severity: item.severity,
        status: mStatuses[i % mStatuses.length],
      });
    }
  }
  await prisma.maintenance_issues.createMany({ data: maintenanceRecords, skipDuplicates: true });

  // Channels
  const channels = [
    { id: uuid(), slug: "airbnb", display_name: "Airbnb", status: "active" },
    { id: uuid(), slug: "booking-com", display_name: "Booking.com", status: "active" },
    { id: uuid(), slug: "agoda", display_name: "Agoda", status: "active" },
  ];
  for (const ch of channels) {
    await prisma.channels.upsert({ where: { slug: ch.slug }, update: ch, create: ch });
  }

  // External accounts
  const extAccounts = [
    { id: uuid(), channel_id: channels[0].id, account_key: "airbnb-main", display_name: "Airbnb Main", status: "active" },
    { id: uuid(), channel_id: channels[0].id, account_key: "airbnb-ruby", display_name: "Airbnb Ruby", status: "active" },
    { id: uuid(), channel_id: channels[1].id, account_key: "booking-main", display_name: "Booking.com Main", status: "active" },
    { id: uuid(), channel_id: channels[2].id, account_key: "agoda-main", display_name: "Agoda Main", status: "active" },
  ];
  await prisma.external_accounts.createMany({ data: extAccounts, skipDuplicates: true });

  // Guests (legacy table)
  const guestRecords = reservationRecords.map((r) => ({
    id: uuid(),
    property_id: r.property_id,
    room_id: r.primary_room_id,
    guest_name: r.guest_name,
    eta: r.check_in_date,
    etd: r.check_out_date,
    check_in_status: r.status === "checked_in" ? "Checked In" : r.status === "check_in_pending" ? "Check-In Pending" : r.status === "check_out_pending" ? "Check-Out Pending" : "Pending",
    booking_source: r.operational_notes.match(/booking_source=([^;]+)/)?.[1] ?? "Direct",
    is_vip: /is_vip=true/.test(r.operational_notes),
    guest_count: r.guest_count,
  }));
  await prisma.guests.createMany({ data: guestRecords, skipDuplicates: true });

  console.log(`Seeded: ${props.length} properties, ${roomRecords.length} rooms, ${reservationRecords.length} reservations, ${maintenanceRecords.length} maintenance issues, ${channels.length} channels, ${extAccounts.length} accounts, ${guestRecords.length} guests`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); process.exit(1); });
