import "dotenv/config";

/**
 * Track B Backend - Express.js + Prisma server scaffold.
 * Mirrors Track A balanced-core schema contract.
 */

import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import cors from "cors";
import compression from "compression";
import { PrismaClient } from "@prisma/client";
import { registerIngestRoutes } from "./ingest/routes";

const app = express();
const prisma = new PrismaClient();
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RESERVATION_STATUSES = new Set([
  "pending",
  "check_in_pending",
  "checked_in",
  "check_out_pending",
  "checked_out",
  "cancelled",
  "no_show",
]);
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : DEFAULT_ALLOWED_ORIGINS;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"));
    },
  })
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));

registerIngestRoutes(app);

function getVietnamToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function toDateOnly(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function toDateKey(input: Date | string) {
  return new Date(input).toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number) {
  const date = toDateOnly(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

function clampDays(value: string | undefined, fallback = 30) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 60);
}

function getOptionalPagination(query: Request["query"]): { take?: number; skip?: number } {
  const limitValue = typeof query.limit === "string" ? query.limit : undefined;
  const offsetValue = typeof query.offset === "string" ? query.offset : undefined;

  if (!limitValue && !offsetValue) {
    return {};
  }

  const parsedLimit = Number.parseInt(limitValue ?? "100", 10);
  const parsedOffset = Number.parseInt(offsetValue ?? "0", 10);

  return {
    take: Math.min(Math.max(Number.isNaN(parsedLimit) ? 100 : parsedLimit, 1), 500),
    skip: Math.max(Number.isNaN(parsedOffset) ? 0 : parsedOffset, 0),
  };
}

function setShortCache(res: Response, seconds: number) {
  res.set("Cache-Control", `private, max-age=${seconds}, stale-while-revalidate=${seconds}`);
}

function setNoStore(res: Response) {
  res.set("Cache-Control", "no-store");
}

function isValidDateKey(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = toDateOnly(value);
  return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
}

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// Health check
app.get("/health", (_, res) => {
  res.json({ status: "ok", track: "B" });
});

// =============================================================================
// Properties
// =============================================================================

app.get("/api/properties", asyncHandler(async (_, res) => {
  setShortCache(res, 300);
  const properties = await prisma.properties.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      total_rooms: true,
      location: true,
      status: true,
      created_at: true,
    },
  });
  res.json(properties);
}));

// =============================================================================
// Reservations (main booking endpoint)
// =============================================================================

app.get("/api/reservations", asyncHandler(async (req, res) => {
  setNoStore(res);
  const {
    property_id,
    status,
    start_date,
    end_date,
    check_in_date,
    check_out_date,
  } = req.query;
  const pagination = getOptionalPagination(req.query);

  const where: any = {};
  if (property_id) where.property_id = property_id;
  if (status) {
    if (typeof status !== "string" || !RESERVATION_STATUSES.has(status)) {
      res.status(400).json({ error: "Invalid reservation status" });
      return;
    }
    where.status = status;
  }
  if (check_in_date) {
    if (typeof check_in_date !== "string" || !isValidDateKey(check_in_date)) {
      res.status(400).json({ error: "Invalid check_in_date" });
      return;
    }
    where.check_in_date = toDateOnly(check_in_date as string);
  }
  if (check_out_date) {
    if (typeof check_out_date !== "string" || !isValidDateKey(check_out_date)) {
      res.status(400).json({ error: "Invalid check_out_date" });
      return;
    }
    where.check_out_date = toDateOnly(check_out_date as string);
  }
  if (start_date && end_date) {
    if (
      typeof start_date !== "string" ||
      typeof end_date !== "string" ||
      !isValidDateKey(start_date) ||
      !isValidDateKey(end_date)
    ) {
      res.status(400).json({ error: "Invalid date range" });
      return;
    }
    where.check_in_date = { gte: new Date(start_date as string) };
    where.check_out_date = { lte: new Date(end_date as string) };
  }

  const [reservations, total] = await Promise.all([
    prisma.reservations.findMany({
      where,
      ...pagination,
      orderBy: { check_in_date: "asc" },
      select: {
        id: true,
        property_id: true,
        primary_room_id: true,
        status: true,
        check_in_date: true,
        check_out_date: true,
        guest_name: true,
        guest_phone: true,
        guest_email: true,
        adult_count: true,
        child_count: true,
        infant_count: true,
        guest_count: true,
        operational_notes: true,
        guest_notes: true,
        created_at: true,
        updated_at: true,
      },
    }),
    prisma.reservations.count({ where }),
  ]);
  res.set("X-Total-Count", String(total));
  res.json(reservations);
}));

app.get("/api/stats/occupancy", asyncHandler(async (req, res) => {
  setShortCache(res, 30);
  const propertyId =
    typeof req.query.property_id === "string" ? req.query.property_id : undefined;
  const days = clampDays(
    typeof req.query.days === "string" ? req.query.days : undefined
  );
  const endDate =
    typeof req.query.end_date === "string" ? req.query.end_date : getVietnamToday();

  if (!isValidDateKey(endDate)) {
    res.status(400).json({ error: "Invalid end_date" });
    return;
  }

  const startDate = addDays(endDate, -(days - 1));
  const endExclusive = addDays(endDate, 1);

  const propertyWhere = propertyId ? { id: propertyId } : undefined;

  const [properties, rooms, reservations] = await Promise.all([
    prisma.properties.findMany({
      where: propertyWhere,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        total_rooms: true,
        location: true,
        status: true,
        created_at: true,
      },
    }),
    prisma.rooms.findMany({
      where: propertyId ? { property_id: propertyId } : undefined,
      select: {
        id: true,
        property_id: true,
      },
    }),
    prisma.reservations.findMany({
      where: {
        ...(propertyId ? { property_id: propertyId } : {}),
        status: { notIn: ["cancelled", "no_show"] },
        check_in_date: { lt: toDateOnly(endExclusive) },
        check_out_date: { gt: toDateOnly(startDate) },
      },
      select: {
        id: true,
        primary_room_id: true,
        check_in_date: true,
        check_out_date: true,
        reservation_room_allocations: {
          select: { room_id: true },
        },
      },
      orderBy: { check_in_date: "asc" },
    }),
  ]);

  const totalRooms = propertyId
    ? rooms.length || properties[0]?.total_rooms || 0
    : properties.reduce((sum, property) => {
        const propertyRoomCount = rooms.filter(
          (room) => room.property_id === property.id
        ).length;
        return sum + (propertyRoomCount || property.total_rooms || 0);
      }, 0);

  const points = Array.from({ length: days }, (_, index) => {
    const date = addDays(startDate, index);
    const occupiedRooms = new Set<string>();

    for (const reservation of reservations) {
      const checkIn = toDateKey(reservation.check_in_date);
      const checkOut = toDateKey(reservation.check_out_date);
      const isActive = checkIn <= date && date < checkOut;

      if (!isActive) {
        continue;
      }

      if (reservation.reservation_room_allocations.length > 0) {
        for (const allocation of reservation.reservation_room_allocations) {
          occupiedRooms.add(allocation.room_id);
        }
        continue;
      }

      if (reservation.primary_room_id) {
        occupiedRooms.add(reservation.primary_room_id);
        continue;
      }

      occupiedRooms.add(`reservation:${reservation.id}`);
    }

    const occupied = occupiedRooms.size;
    const available = Math.max(totalRooms - occupied, 0);

    return {
      date,
      occupied,
      available,
      totalRooms,
    };
  });

  res.json(points);
}));

app.get("/api/reservations/:id", asyncHandler(async (req, res) => {
  const reservation = await prisma.reservations.findUnique({
    where: { id: req.params.id },
    include: {
      reservation_external_refs: true,
      reservation_room_allocations: true,
    },
  });
  if (!reservation) return res.status(404).json({ error: "Not found" });
  res.json(reservation);
}));

// =============================================================================
// Rooms
// =============================================================================

app.get("/api/rooms", asyncHandler(async (req, res) => {
  setShortCache(res, 60);
  const { property_id } = req.query;
  const pagination = getOptionalPagination(req.query);
  const where: any = property_id ? { property_id: property_id as string } : {};
  const [rooms, total] = await Promise.all([
    prisma.rooms.findMany({
      where,
      ...pagination,
      select: {
        id: true,
        property_id: true,
        room_number: true,
        room_name: true,
        room_type: true,
        status: true,
        passcode: true,
        floor: true,
        created_at: true,
      },
    }),
    prisma.rooms.count({ where }),
  ]);
  res.set("X-Total-Count", String(total));
  res.json(rooms);
}));

// =============================================================================
// Maintenance
// =============================================================================

app.get("/api/maintenance", asyncHandler(async (req, res) => {
  setNoStore(res);
  const { property_id, status } = req.query;
  const pagination = getOptionalPagination(req.query);
  const where: any = {};
  if (property_id) where.property_id = property_id;
  if (status) where.status = status;
  const [issues, total] = await Promise.all([
    prisma.maintenance_issues.findMany({
      where,
      ...pagination,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        property_id: true,
        room_id: true,
        title: true,
        description: true,
        severity: true,
        status: true,
        created_at: true,
      },
    }),
    prisma.maintenance_issues.count({ where }),
  ]);
  res.set("X-Total-Count", String(total));
  res.json(issues);
}));

// =============================================================================
// Channels / External Accounts
// =============================================================================

app.get("/api/channels", asyncHandler(async (_, res) => {
  setShortCache(res, 300);
  const channels = await prisma.channels.findMany({
    select: {
      id: true,
      slug: true,
      display_name: true,
      status: true,
      created_at: true,
      updated_at: true,
      external_accounts: {
        select: {
          id: true,
          channel_id: true,
          account_key: true,
          display_name: true,
          status: true,
          archived_at: true,
          last_synced_at: true,
          last_sync_started_at: true,
          last_sync_error: true,
          created_at: true,
          updated_at: true,
        },
      },
    },
  });
  res.json(channels);
}));

app.get("/api/external-accounts", asyncHandler(async (req, res) => {
  setShortCache(res, 300);
  const { channel_id } = req.query;
  const where: any = channel_id ? { channel_id: channel_id as string } : {};
  const accounts = await prisma.external_accounts.findMany({
    where,
    select: {
      id: true,
      channel_id: true,
      account_key: true,
      display_name: true,
      status: true,
      archived_at: true,
      last_synced_at: true,
      last_sync_started_at: true,
      last_sync_error: true,
      created_at: true,
      updated_at: true,
    },
  });
  res.json(accounts);
}));

// =============================================================================
// Guest Requests
// =============================================================================

app.get("/api/guest-requests", asyncHandler(async (req, res) => {
  setNoStore(res);
  const { property_id, guest_id, reservation_id } = req.query;
  const pagination = getOptionalPagination(req.query);
  const where: any = {};
  if (property_id) where.property_id = property_id;
  if (guest_id) where.guest_id = guest_id;
  if (reservation_id) where.reservation_id = reservation_id;
  const [requests, total] = await Promise.all([
    prisma.guest_requests.findMany({
      where,
      ...pagination,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        guest_id: true,
        room_id: true,
        property_id: true,
        reservation_id: true,
        request_type: true,
        notes: true,
        is_completed: true,
        created_at: true,
      },
    }),
    prisma.guest_requests.count({ where }),
  ]);
  res.set("X-Total-Count", String(total));
  res.json(requests);
}));

// =============================================================================
// Guests (legacy compatibility)
// =============================================================================

app.get("/api/guests", asyncHandler(async (req, res) => {
  setNoStore(res);
  const { property_id, room_id } = req.query;
  const pagination = getOptionalPagination(req.query);
  const where: any = {};
  if (property_id) where.property_id = property_id;
  if (room_id) where.room_id = room_id;
  const [guests, total] = await Promise.all([
    prisma.guests.findMany({
      where,
      ...pagination,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        property_id: true,
        room_id: true,
        guest_name: true,
        eta: true,
        etd: true,
        check_in_status: true,
        booking_source: true,
        is_vip: true,
        guest_count: true,
        created_at: true,
      },
    }),
    prisma.guests.count({ where }),
  ]);
  res.set("X-Total-Count", String(total));
  res.json(guests);
}));

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error("Unhandled route error", error);
    res.status(500).json({ error: "Internal server error" });
  }
);

// =============================================================================
// Start server
// =============================================================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Track B server running on port ${PORT}`);
});

export { prisma };
