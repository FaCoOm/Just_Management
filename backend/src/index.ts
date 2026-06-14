import "dotenv/config";
import { validateEnv } from "./config/env-validator";

validateEnv();

import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import cors from "cors";
import compression from "compression";
import { Prisma } from "@prisma/client";
import { registerIngestRoutes } from "./ingest/routes";
import { startFolderWatcher } from "./ingest/watchers/folder";
import { WithOneProviderConnector } from "./integrations/provider-connector";
import { prisma } from "./lib/prisma";
import { registerOneRoutes } from "./routes/one";
import { registerTaxExportRoutes } from "./tax-export/routes";
import { deriveOccupancyMetrics } from "./dashboard/occupancy";

const app = express();
const SLOW_REQUEST_THRESHOLD_MS = Number.parseInt(
  process.env.SLOW_REQUEST_THRESHOLD_MS ?? "500",
  10
);
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
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
  "http://host.docker.internal:5173",
  "http://host.docker.internal:4173",
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
app.use(compression() as unknown as express.RequestHandler);
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const originalEnd = res.end;

  res.end = function endWithTiming(this: Response, ...args: Parameters<Response["end"]>) {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (!res.headersSent) {
      res.setHeader("X-Response-Time", `${durationMs.toFixed(1)}ms`);
    }

    return originalEnd.apply(this, args);
  } as Response["end"];

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
      console.warn(
        `Slow request ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`
      );
    }
  });

  next();
});

registerIngestRoutes(app);
registerOneRoutes(app, prisma);
registerTaxExportRoutes(app, prisma);

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

function shouldIncludeCount(query: Request["query"]) {
  return query.include_count === "true" || query.includeCount === "true";
}

async function sendListResponse<T>(
  res: Response,
  rowsQuery: Promise<T[]>,
  countQuery: Promise<number> | undefined
) {
  const [rows, total] = await Promise.all([rowsQuery, countQuery]);

  if (countQuery) {
    res.set("X-Total-Count", String(total));
  }

  res.json(rows);
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

interface ValidationIssue {
  field: string;
  message: string;
}

function bodyString(body: Record<string, unknown>, key: string): string {
  const val = body[key];
  return typeof val === "string" ? val.trim() : "";
}

function bodyInt(body: Record<string, unknown>, key: string, fallback: number): number {
  const val = body[key];
  if (typeof val === "number") {
    return Math.floor(val);
  }
  if (typeof val === "string") {
    const parsed = Number.parseInt(val, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

function optionalBodyString(body: Record<string, unknown>, key: string, maxLength?: number): string | null {
  const val = body[key];
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (trimmed === "") return null;
  return maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function toCompatibilityDate(input: Date | string) {
  return input instanceof Date ? input.toISOString() : input;
}

function toCompatibilityStatus(status: string) {
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
    case "pending":
    default:
      return "Pending";
  }
}

function toDashboardGuest(reservation: {
  id: string;
  property_id: string;
  primary_room_id: string | null;
  status: string;
  check_in_date: Date | string;
  check_out_date: Date | string;
  guest_name: string;
  guest_count: number;
  operational_notes: string;
  created_at: Date | string;
}) {
  const bookingSource = reservation.operational_notes
    .match(/booking_source=([^;]+)/i)?.[1]
    ?.trim();

  return {
    id: reservation.id,
    reservation_id: reservation.id,
    property_id: reservation.property_id,
    room_id: reservation.primary_room_id,
    guest_name: reservation.guest_name,
    eta: toCompatibilityDate(reservation.check_in_date),
    etd: toCompatibilityDate(reservation.check_out_date),
    check_in_status: toCompatibilityStatus(reservation.status),
    booking_source: bookingSource || "Reservation",
    is_vip: /is_vip=true/i.test(reservation.operational_notes),
    guest_count: reservation.guest_count,
    created_at: toCompatibilityDate(reservation.created_at),
  };
}

function filterReservationsByStatus<T extends { status: string }>(
  reservations: T[],
  statuses: string[]
) {
  return reservations.filter((reservation) => statuses.includes(reservation.status));
}

function buildOccupancySeries(input: {
  days: number;
  endDate: string;
  properties: Array<{ id: string; total_rooms: number }>;
  rooms: Array<{ id: string; property_id: string }>;
  reservations: Array<{
    id: string;
    primary_room_id: string | null;
    check_in_date: Date | string;
    check_out_date: Date | string;
    reservation_room_allocations: Array<{ room_id: string }>;
  }>;
}) {
  const startDate = addDays(input.endDate, -(input.days - 1));
  const totalRooms = input.properties.reduce((sum, property) => {
    const propertyRoomCount = input.rooms.filter(
      (room) => room.property_id === property.id
    ).length;
    return sum + (propertyRoomCount || property.total_rooms || 0);
  }, 0);

  return Array.from({ length: input.days }, (_, index) => {
    const date = addDays(startDate, index);
    const occupiedRooms = new Set<string>();

    for (const reservation of input.reservations) {
      const checkIn = toDateKey(reservation.check_in_date);
      const checkOut = toDateKey(reservation.check_out_date);
      if (!(checkIn <= date && date < checkOut)) continue;

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
    return {
      date,
      occupied,
      available: Math.max(totalRooms - occupied, 0),
      totalRooms,
    };
  });
}

// Health check
app.get("/health", (_, res) => {
  res.json({ status: "ok", track: "B" });
});

app.get("/api/integrations/status", asyncHandler(async (_req, res) => {
  const connectionKey = process.env.ONE_CONNECTION_KEY;

  if (!connectionKey) {
    res.json({
      status: "disconnected",
      provider: "withone",
      error: "ONE_CONNECTION_KEY not configured",
    });
    return;
  }

  const connector = new WithOneProviderConnector(connectionKey);
  const status = await connector.getConnectionStatus();
  res.json({
    status: status.connected ? "connected" : "disconnected",
    provider: "withone",
    ...(status.error ? { error: status.error } : {}),
  });
}));

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

app.get("/api/properties/:id", asyncHandler(async (req, res) => {
  setShortCache(res, 300);
  const property = await prisma.properties.findUnique({
    where: { id: req.params.id },
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

  if (!property) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(property);
}));

app.get("/api/dashboard/summary", asyncHandler(async (req, res) => {
  setNoStore(res);
  const date = typeof req.query.date === "string" ? req.query.date : getVietnamToday();
  const propertyId =
    typeof req.query.property_id === "string" ? req.query.property_id : undefined;
  const days = clampDays(
    typeof req.query.days === "string" ? req.query.days : undefined,
    7
  );

  if (!isValidDateKey(date)) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }

  const propertyWhere = propertyId ? { id: propertyId } : undefined;
  const scopedReservationWhere = propertyId ? { property_id: propertyId } : {};
  const occupancyStartDate = date;
  const occupancyEndDate = addDays(date, days - 1);
  const occupancyEndExclusive = addDays(occupancyEndDate, 1);

  const reservationSelect = {
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
  } satisfies Prisma.reservationsSelect;

  const [properties, rooms, reservations, requests, maintenance, arrivals, departures, occupancyReservations] = await Promise.all([
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
        room_number: true,
        room_name: true,
        room_type: true,
        status: true,
        floor: true,
        created_at: true,
      },
    }),
    prisma.reservations.findMany({
      where: scopedReservationWhere,
      orderBy: { check_in_date: "asc" },
      select: reservationSelect,
    }),
    prisma.guest_requests.findMany({
      where: propertyId ? { property_id: propertyId } : undefined,
      orderBy: { created_at: "desc" },
      take: 50,
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
    prisma.maintenance_issues.findMany({
      where: propertyId ? { property_id: propertyId } : undefined,
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
    prisma.reservations.findMany({
      where: { ...scopedReservationWhere, check_in_date: toDateOnly(date) },
      orderBy: { check_in_date: "asc" },
      select: reservationSelect,
    }),
    prisma.reservations.findMany({
      where: { ...scopedReservationWhere, check_out_date: toDateOnly(date) },
      orderBy: { check_out_date: "asc" },
      select: reservationSelect,
    }),
    prisma.reservations.findMany({
      where: {
        ...scopedReservationWhere,
        status: { notIn: ["cancelled", "no_show"] },
        check_in_date: { lt: toDateOnly(occupancyEndExclusive) },
        check_out_date: { gt: toDateOnly(occupancyStartDate) },
      },
      select: {
        id: true,
        primary_room_id: true,
        check_in_date: true,
        check_out_date: true,
        reservation_room_allocations: { select: { room_id: true } },
      },
      orderBy: { check_in_date: "asc" },
    }),
  ]);

  const arrivalReservations = filterReservationsByStatus(arrivals, [
    "pending",
    "check_in_pending",
  ]);
  const departureReservations = filterReservationsByStatus(departures, [
    "check_out_pending",
  ]);
  const checkoutReservations = filterReservationsByStatus(departures, [
    "check_out_pending",
    "checked_out",
  ]);
  const guests = reservations.map(toDashboardGuest);
  const todayArrivals = arrivalReservations.map(toDashboardGuest);
  const todayDepartures = departureReservations.map(toDashboardGuest);
  const todayCheckouts = checkoutReservations.map(toDashboardGuest);

  const occupancyMetrics = deriveOccupancyMetrics({
    date,
    properties,
    rooms,
    reservations: occupancyReservations,
  });

  const metrics = properties.map((property) => {
    const propertyRooms = rooms.filter((room) => room.property_id === property.id);
    const propertyMaintenance = maintenance.filter(
      (issue) => issue.property_id === property.id
    );
    const occupiedRooms = occupancyMetrics.perProperty.get(property.id)?.occupiedRooms ?? 0;
    const totalRooms = propertyRooms.length || property.total_rooms || 1;

    return {
      property,
      arrivals: arrivalReservations.filter(
        (reservation) => reservation.property_id === property.id
      ).length,
      departures: departureReservations.filter(
        (reservation) => reservation.property_id === property.id
      ).length,
      occupancyRate: Math.round((occupiedRooms / totalRooms) * 100),
      occupiedRooms,
      maintenanceOpen: propertyMaintenance.filter(
        (issue) => issue.status !== "Resolved"
      ).length,
    };
  });

  res.json({
    properties,
    rooms,
    reservations,
    guests,
    requests,
    maintenance,
    metrics,
    todayArrivals,
    todayDepartures,
    todayCheckouts,
    totals: {
      arrivals: todayArrivals.length,
      departures: todayDepartures.length,
      occupancyRate: occupancyMetrics.occupancyRate,
      maintenanceOpen: metrics.reduce((sum, metric) => sum + metric.maintenanceOpen, 0),
    },
    occupancySeries: buildOccupancySeries({
      days,
      endDate: occupancyEndDate,
      properties,
      rooms,
      reservations: occupancyReservations,
    }),
  });
}));

// =============================================================================
// Reservations (main booking endpoint)
// =============================================================================

app.post("/api/reservations", asyncHandler(async (req, res) => {
  setNoStore(res);
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  const errors: ValidationIssue[] = [];

  const propertyId = bodyString(body, "property_id");
  const primaryRoomId = bodyString(body, "primary_room_id") || null;
  const guestName = bodyString(body, "guest_name");
  const checkInDate = bodyString(body, "check_in_date");
  const checkOutDate = bodyString(body, "check_out_date");
  const status = bodyString(body, "status") || "pending";
  const adultCount = bodyInt(body, "adult_count", 1);
  const childCount = bodyInt(body, "child_count", 0);
  const infantCount = bodyInt(body, "infant_count", 0);
  const guestCount = bodyInt(body, "guest_count", adultCount + childCount + infantCount);

  if (!propertyId) errors.push({ field: "property_id", message: "property_id is required" });
  if (!guestName) errors.push({ field: "guest_name", message: "guest_name is required" });
  if (guestName.length > 200) errors.push({ field: "guest_name", message: "guest_name must be 200 characters or fewer" });
  if (!isValidDateKey(checkInDate)) errors.push({ field: "check_in_date", message: "check_in_date must be YYYY-MM-DD" });
  if (!isValidDateKey(checkOutDate)) errors.push({ field: "check_out_date", message: "check_out_date must be YYYY-MM-DD" });
  if (isValidDateKey(checkInDate) && isValidDateKey(checkOutDate) && checkInDate >= checkOutDate) {
    errors.push({ field: "check_out_date", message: "check_out_date must be after check_in_date" });
  }
  if (!RESERVATION_STATUSES.has(status)) errors.push({ field: "status", message: "Invalid reservation status" });
  if (adultCount < 1) errors.push({ field: "adult_count", message: "adult_count must be at least 1" });
  if (childCount < 0) errors.push({ field: "child_count", message: "child_count must be 0 or greater" });
  if (infantCount < 0) errors.push({ field: "infant_count", message: "infant_count must be 0 or greater" });
  if (guestCount < adultCount) errors.push({ field: "guest_count", message: "guest_count must be at least adult_count" });

  if (errors.length > 0) {
    res.status(400).json({ error: "Invalid reservation", errors });
    return;
  }

  const property = await prisma.properties.findUnique({ where: { id: propertyId }, select: { id: true } });
  if (!property) {
    res.status(404).json({ error: "Property not found", errors: [{ field: "property_id", message: "Property not found" }] });
    return;
  }

  if (primaryRoomId) {
    const room = await prisma.rooms.findFirst({ where: { id: primaryRoomId, property_id: propertyId }, select: { id: true } });
    if (!room) {
      res.status(404).json({ error: "Room not found", errors: [{ field: "primary_room_id", message: "Room not found for selected property" }] });
      return;
    }
  }

  const reservation = await prisma.reservations.create({
    data: {
      property_id: propertyId,
      primary_room_id: primaryRoomId,
      status,
      check_in_date: toDateOnly(checkInDate),
      check_out_date: toDateOnly(checkOutDate),
      guest_name: guestName,
      guest_phone: optionalBodyString(body, "guest_phone", 80),
      guest_email: optionalBodyString(body, "guest_email", 160),
      adult_count: adultCount,
      child_count: childCount,
      infant_count: infantCount,
      guest_count: guestCount,
      operational_notes: optionalBodyString(body, "operational_notes", 1000) ?? "booking_source=Manual",
      guest_notes: optionalBodyString(body, "guest_notes", 1000) ?? "",
    },
  });

  res.status(201).json(reservation);
}));

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
  const includeCount = shouldIncludeCount(req.query);

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

  await sendListResponse(
    res,
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
        reservation_room_allocations: {
          select: {
            id: true,
            reservation_id: true,
            room_id: true,
            allocation_role: true,
            sort_order: true,
            notes: true,
            created_at: true,
            updated_at: true,
          },
          orderBy: { sort_order: "asc" },
        },
      },
    }),
    includeCount ? prisma.reservations.count({ where }) : undefined
  );
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
  const includeCount = shouldIncludeCount(req.query);
  const where: any = property_id ? { property_id: property_id as string } : {};
  await sendListResponse(
    res,
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
        floor: true,
        created_at: true,
      },
    }),
    includeCount ? prisma.rooms.count({ where }) : undefined
  );
}));

app.get("/api/rooms/:id", asyncHandler(async (req, res) => {
  setShortCache(res, 60);
  const room = await prisma.rooms.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      property_id: true,
      room_number: true,
      room_name: true,
      room_type: true,
      status: true,
      floor: true,
      created_at: true,
    },
  });

  if (!room) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(room);
}));

// =============================================================================
// Maintenance
// =============================================================================

app.get("/api/maintenance", asyncHandler(async (req, res) => {
  setNoStore(res);
  const { property_id, status } = req.query;
  const pagination = getOptionalPagination(req.query);
  const includeCount = shouldIncludeCount(req.query);
  const where: any = {};
  if (property_id) where.property_id = property_id;
  if (status) where.status = status;
  await sendListResponse(
    res,
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
    includeCount ? prisma.maintenance_issues.count({ where }) : undefined
  );
}));

app.get("/api/maintenance/:id", asyncHandler(async (req, res) => {
  setNoStore(res);
  const issue = await prisma.maintenance_issues.findUnique({
    where: { id: req.params.id },
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
  });

  if (!issue) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(issue);
}));

app.post("/api/maintenance", asyncHandler(async (req, res) => {
  setNoStore(res);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const title = bodyString(body, "title").trim();
  const description = (typeof body.description === "string" ? body.description.trim() : "") || "";
  const priorityRaw = bodyString(body, "priority").toLowerCase();
  const propertyId = bodyString(body, "property_id");
  const roomId = typeof body.room_id === "string" && body.room_id ? body.room_id : null;
  const errors: string[] = [];
  if (!title) errors.push("title is required");
  if (!propertyId) errors.push("property_id is required");
  const priorityMap: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
  const severity = priorityMap[priorityRaw];
  if (!severity) errors.push("priority must be low, medium, high, or critical");
  if (errors.length > 0) { res.status(400).json({ error: "Invalid maintenance issue", errors }); return; }
  const property = await prisma.properties.findUnique({ where: { id: propertyId }, select: { id: true } });
  if (!property) { res.status(404).json({ error: "Property not found" }); return; }
  const issue = await prisma.maintenance_issues.create({
    data: { property_id: propertyId, room_id: roomId, title, description, severity: severity!, status: "Open" },
    select: { id: true, property_id: true, room_id: true, title: true, description: true, severity: true, status: true, created_at: true },
  });
  res.status(201).json(issue);
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
  const includeCount = shouldIncludeCount(req.query);
  const where: any = {};
  if (property_id) where.property_id = property_id;
  if (guest_id) where.guest_id = guest_id;
  if (reservation_id) where.reservation_id = reservation_id;
  await sendListResponse(
    res,
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
    includeCount ? prisma.guest_requests.count({ where }) : undefined
  );
}));

app.get("/api/guest-requests/:id", asyncHandler(async (req, res) => {
  setNoStore(res);
  const request = await prisma.guest_requests.findUnique({
    where: { id: req.params.id },
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
  });

  if (!request) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(request);
}));

// =============================================================================
// Guests (legacy compatibility)
// =============================================================================

app.get("/api/guests", asyncHandler(async (req, res) => {
  setNoStore(res);
  const { property_id, room_id } = req.query;
  const pagination = getOptionalPagination(req.query);
  const includeCount = shouldIncludeCount(req.query);
  const where: any = {};
  if (property_id) where.property_id = property_id;
  if (room_id) where.room_id = room_id;
  await sendListResponse(
    res,
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
    includeCount ? prisma.guests.count({ where }) : undefined
  );
}));

// =============================================================================
// Operations page data (read-only)
// =============================================================================

app.get("/api/dining-events", asyncHandler(async (req, res) => {
  setNoStore(res);
  const propertyId = typeof req.query.property_id === "string" ? req.query.property_id : undefined;
  const date = typeof req.query.date === "string" ? req.query.date : undefined;

  if (date && !isValidDateKey(date)) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }

  const events = await prisma.dining_event_bookings.findMany({
    where: {
      ...(propertyId ? { property_id: propertyId } : {}),
      ...(date ? { date: toDateOnly(date) } : {}),
    },
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
    select: {
      id: true,
      title: true,
      type: true,
      venue: true,
      date: true,
      start_time: true,
      end_time: true,
      guest_count: true,
      guest_name: true,
      property_id: true,
      status: true,
      notes: true,
    },
  });

  res.json(events.map((event) => ({
    ...event,
    date: toDateKey(event.date),
  })));
}));

app.get("/api/staff", asyncHandler(async (_req, res) => {
  setNoStore(res);
  const staff = await prisma.staff_members.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      property_ids: true,
      status: true,
      last_active_at: true,
    },
  });

  res.json(staff);
}));

app.get("/api/security/audit", asyncHandler(async (req, res) => {
  setNoStore(res);
  const severity = typeof req.query.severity === "string" ? req.query.severity : undefined;
  const limitValue = typeof req.query.limit === "string" ? req.query.limit : undefined;
  const parsedLimit = Number.parseInt(limitValue ?? "100", 10);
  const take = Math.min(Math.max(Number.isNaN(parsedLimit) ? 100 : parsedLimit, 1), 500);

  const entries = await prisma.security_audit_entries.findMany({
    where: severity ? { severity } : undefined,
    orderBy: { timestamp: "desc" },
    take,
    select: {
      id: true,
      timestamp: true,
      action: true,
      actor: true,
      resource: true,
      details: true,
      severity: true,
    },
  });

  res.json(entries);
}));

app.get("/api/rates", asyncHandler(async (req, res) => {
  setNoStore(res);
  const propertyId = typeof req.query.property_id === "string" ? req.query.property_id : undefined;
  const roomType = typeof req.query.room_type === "string" ? req.query.room_type : undefined;
  const startDate = typeof req.query.start_date === "string" ? req.query.start_date : undefined;
  const endDate = typeof req.query.end_date === "string" ? req.query.end_date : undefined;

  if ((startDate && !isValidDateKey(startDate)) || (endDate && !isValidDateKey(endDate))) {
    res.status(400).json({ error: "Invalid date range" });
    return;
  }

  const rates = await prisma.room_rates.findMany({
    where: {
      ...(propertyId ? { OR: [{ property_id: propertyId }, { property_id: null }] } : {}),
      ...(roomType ? { room_type: roomType } : {}),
      ...((startDate || endDate) ? {
        date: {
          ...(startDate ? { gte: toDateOnly(startDate) } : {}),
          ...(endDate ? { lte: toDateOnly(endDate) } : {}),
        },
      } : {}),
    },
    orderBy: [{ room_type: "asc" }, { date: "asc" }, { property_id: "asc" }],
    select: {
      id: true,
      property_id: true,
      room_type: true,
      date: true,
      base_rate_vnd: true,
      rate_vnd: true,
    },
  });

  res.json(rates.map((rate) => ({
    ...rate,
    date: toDateKey(rate.date),
  })));
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

async function startServer() {
  try {
    const startedAt = process.hrtime.bigint();
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(`Prisma connection warmed in ${durationMs.toFixed(1)}ms`);
  } catch (error) {
    console.warn("Prisma warm-up failed; continuing startup", error);
  }

  app.listen(PORT, () => {
    console.log(`Track B server running on port ${PORT}`);
    startFolderWatcher();
  });
}

void startServer();

export { prisma };
