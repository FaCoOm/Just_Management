/**
 * Track B Backend - Express.js + Prisma server scaffold.
 * Mirrors Track A balanced-core schema contract.
 */

import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_, res) => {
  res.json({ status: "ok", track: "B" });
});

// =============================================================================
// Properties
// =============================================================================

app.get("/api/properties", async (_, res) => {
  const properties = await prisma.properties.findMany({ orderBy: { name: "asc" } });
  res.json(properties);
});

// =============================================================================
// Reservations (main booking endpoint)
// =============================================================================

app.get("/api/reservations", async (req, res) => {
  const { property_id, status, start_date, end_date } = req.query;

  const where: any = {};
  if (property_id) where.property_id = property_id;
  if (status) where.status = status;
  if (start_date && end_date) {
    where.check_in_date = { gte: new Date(start_date as string) };
    where.check_out_date = { lte: new Date(end_date as string) };
  }

  const reservations = await prisma.reservations.findMany({
    where,
    orderBy: { check_in_date: "asc" },
  });
  res.json(reservations);
});

app.get("/api/reservations/:id", async (req, res) => {
  const reservation = await prisma.reservations.findUnique({
    where: { id: req.params.id },
    include: {
      reservation_external_refs: true,
      reservation_room_allocations: true,
    },
  });
  if (!reservation) return res.status(404).json({ error: "Not found" });
  res.json(reservation);
});

// =============================================================================
// Rooms
// =============================================================================

app.get("/api/rooms", async (req, res) => {
  const { property_id } = req.query;
  const where: any = property_id ? { property_id: property_id as string } : {};
  const rooms = await prisma.rooms.findMany({ where });
  res.json(rooms);
});

// =============================================================================
// Maintenance
// =============================================================================

app.get("/api/maintenance", async (req, res) => {
  const { property_id, status } = req.query;
  const where: any = {};
  if (property_id) where.property_id = property_id;
  if (status) where.status = status;
  const issues = await prisma.maintenance_issues.findMany({
    where,
    orderBy: { created_at: "desc" },
  });
  res.json(issues);
});

// =============================================================================
// Channels / External Accounts
// =============================================================================

app.get("/api/channels", async (_, res) => {
  const channels = await prisma.channels.findMany({ include: { external_accounts: true } });
  res.json(channels);
});

app.get("/api/external-accounts", async (req, res) => {
  const { channel_id } = req.query;
  const where: any = channel_id ? { channel_id: channel_id as string } : {};
  const accounts = await prisma.external_accounts.findMany({ where });
  res.json(accounts);
});

// =============================================================================
// Start server
// =============================================================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Track B server running on port ${PORT}`);
});

export { prisma };