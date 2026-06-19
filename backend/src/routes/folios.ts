import type { Express, Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { getFolioById, listFolios, postLineItem, recordPayment } from "../services/folio-service.js";

function bodyObject(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body as Record<string, unknown> : {};
}

function queryString(req: Request, key: string): string | undefined {
  return typeof req.query[key] === "string" ? req.query[key] : undefined;
}

export function registerFolioRoutes(app: Express, prisma: PrismaClient): void {
  app.get("/api/folios", async (req: Request, res: Response) => {
    const result = await listFolios(prisma, { reservation_id: queryString(req, "reservation_id"), property_id: queryString(req, "property_id") });
    res.status(result.status).json(result.body);
  });
  app.get("/api/folios/:id", async (req: Request, res: Response) => {
    const result = await getFolioById(prisma, req.params.id);
    res.status(result.status).json(result.body);
  });
  app.post("/api/folios/:id/line-items", async (req: Request, res: Response) => {
    const result = await postLineItem(prisma, req.params.id, bodyObject(req));
    res.status(result.status).json(result.body);
  });
  app.post("/api/folios/:id/payments", async (req: Request, res: Response) => {
    const result = await recordPayment(prisma, req.params.id, bodyObject(req));
    res.status(result.status).json(result.body);
  });
}
