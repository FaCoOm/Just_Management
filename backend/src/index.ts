import "dotenv/config";

/**
 * Track B Backend - Express.js + Prisma server scaffold.
 * Mirrors Track A balanced-core schema contract.
 */

import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import cors from "cors";
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
  const properties = await prisma.properties.findMany({ orderBy: { name: "asc" } });
  res.json(properties);
}));

// =============================================================================
// Reservations (main booking endpoint)
// =============================================================================

app.get("/api/reservations", asyncHandler(async (req, res) => {
  const {
    property_id,
    status,
    start_date,
    end_date,
    check_in_date,
    check_out_date,
  } = req.query;

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

  const reservations = await prisma.reservations.findMany({
    where,
    orderBy: { check_in_date: "asc" },
  });
  res.json(reservations);
}));

app.get("/api/stats/occupancy", asyncHandler(async (req, res) => {
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
      include: {
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
  const { property_id } = req.query;
  const where: any = property_id ? { property_id: property_id as string } : {};
  const rooms = await prisma.rooms.findMany({ where });
  res.json(rooms);
}));

// =============================================================================
// Maintenance
// =============================================================================

app.get("/api/maintenance", asyncHandler(async (req, res) => {
  const { property_id, status } = req.query;
  const where: any = {};
  if (property_id) where.property_id = property_id;
  if (status) where.status = status;
  const issues = await prisma.maintenance_issues.findMany({
    where,
    orderBy: { created_at: "desc" },
  });
  res.json(issues);
}));

// =============================================================================
// Channels / External Accounts
// =============================================================================

app.get("/api/channels", asyncHandler(async (_, res) => {
  const channels = await prisma.channels.findMany({ include: { external_accounts: true } });
  res.json(channels);
}));

app.get("/api/external-accounts", asyncHandler(async (req, res) => {
  const { channel_id } = req.query;
  const where: any = channel_id ? { channel_id: channel_id as string } : {};
  const accounts = await prisma.external_accounts.findMany({ where });
  res.json(accounts);
}));

// =============================================================================
// Guest Requests
// =============================================================================

app.get("/api/guest-requests", asyncHandler(async (req, res) => {
  const { property_id, guest_id, reservation_id } = req.query;
  const where: any = {};
  if (property_id) where.property_id = property_id;
  if (guest_id) where.guest_id = guest_id;
  if (reservation_id) where.reservation_id = reservation_id;
  const requests = await prisma.guest_requests.findMany({
    where,
    orderBy: { created_at: "desc" },
  });
  res.json(requests);
}));

// =============================================================================
// Guests (legacy compatibility)
// =============================================================================

app.get("/api/guests", asyncHandler(async (req, res) => {
  const { property_id, room_id } = req.query;
  const where: any = {};
  if (property_id) where.property_id = property_id;
  if (room_id) where.room_id = room_id;
  const guests = await prisma.guests.findMany({
    where,
    orderBy: { created_at: "desc" },
  });
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
