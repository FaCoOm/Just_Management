import type { Express, Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { operationsEvents } from "../events/operations-events.js";
import { checkIn } from "../services/check-in-service.js";
import { checkOut } from "../services/check-out-service.js";

export function registerCheckInOutRoutes(app: Express, prisma: PrismaClient): void {
  operationsEvents.onCheckoutCompleted((payload) => {
    void Promise.all(payload.roomIds.map((roomId) => prisma.rooms.update({ where: { id: roomId }, data: { status: "Needs Attention" } }))).catch((error: unknown) => {
      console.error("checkout.completed listener failed", error);
    });
  });

  app.post("/api/reservations/:id/check-in", async (req: Request, res: Response) => {
    const result = await checkIn(prisma, req.params.id);
    res.status(result.status).json(result.body);
  });

  app.post("/api/reservations/:id/check-out", async (req: Request, res: Response) => {
    const result = await checkOut(prisma, req.params.id);
    res.status(result.status).json(result.body);
  });
}
