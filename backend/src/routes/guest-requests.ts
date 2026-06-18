import { type Express, type Request, type Response } from "express";
import { type GuestRequestPrisma } from "../services/guest-request-service.js";
import {
  createRequest,
  deleteRequest,
  getRequestById,
  listRequests,
  transitionStatus,
  updateRequest,
} from "../services/guest-request-service.js";

function bodyObject(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? (req.body as Record<string, unknown>)
    : {};
}

function optionalQueryString(req: Request, key: string): string | undefined {
  return typeof req.query[key] === "string" ? req.query[key] : undefined;
}

function optionalQueryInt(req: Request, key: string): number | undefined {
  const value = optionalQueryString(req, key);
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function registerGuestRequestRoutes(app: Express, prisma: GuestRequestPrisma): void {
  app.post("/api/guest-requests", async (req: Request, res: Response) => {
    const result = await createRequest(prisma, bodyObject(req));
    res.status(result.status).json(result.body);
  });

  app.get("/api/guest-requests", async (req: Request, res: Response) => {
    const result = await listRequests(prisma, {
      property_id: optionalQueryString(req, "property_id"),
      status: optionalQueryString(req, "status"),
      assigned_to: optionalQueryString(req, "assigned_to"),
      limit: optionalQueryInt(req, "limit"),
      offset: optionalQueryInt(req, "offset"),
    });

    res.status(result.status).json(result.body);
  });

  app.get("/api/guest-requests/:id", async (req: Request, res: Response) => {
    const result = await getRequestById(prisma, req.params.id);
    res.status(result.status).json(result.body);
  });

  app.patch("/api/guest-requests/:id", async (req: Request, res: Response) => {
    const result = await updateRequest(prisma, req.params.id, bodyObject(req));
    res.status(result.status).json(result.body);
  });

  app.patch("/api/guest-requests/:id/status", async (req: Request, res: Response) => {
    const body = bodyObject(req);
    const result = await transitionStatus(prisma, req.params.id, body.status, body);
    res.status(result.status).json(result.body);
  });

  app.delete("/api/guest-requests/:id", async (req: Request, res: Response) => {
    const result = await deleteRequest(prisma, req.params.id);
    res.status(result.status).json(result.body);
  });
}
