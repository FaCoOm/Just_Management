import { type Express, type Request, type Response } from "express";
import { type StayRegistrationPrisma } from "../services/stay-registration-service.js";
import {
  createStayRegistration,
  deleteStayRegistration,
  getStayRegistrationById,
  listStayRegistrations,
  retryDriveFolder,
  updateStayRegistration,
} from "../services/stay-registration-service.js";

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

export function registerStayRegistrationRoutes(app: Express, prisma: StayRegistrationPrisma): void {
  app.post("/api/stay-registrations", async (req: Request, res: Response) => {
    const result = await createStayRegistration(prisma, bodyObject(req));
    res.status(result.status).json(result.body);
  });

  app.get("/api/stay-registrations", async (req: Request, res: Response) => {
    const result = await listStayRegistrations(prisma, {
      property_id: optionalQueryString(req, "property_id"),
      tenant_id: optionalQueryString(req, "tenant_id"),
      room_id: optionalQueryString(req, "room_id"),
      limit: optionalQueryInt(req, "limit"),
      offset: optionalQueryInt(req, "offset"),
    });

    res.status(result.status).json(result.body);
  });

  app.get("/api/stay-registrations/:id", async (req: Request, res: Response) => {
    const result = await getStayRegistrationById(prisma, req.params.id);
    res.status(result.status).json(result.body);
  });

  app.put("/api/stay-registrations/:id", async (req: Request, res: Response) => {
    const result = await updateStayRegistration(prisma, req.params.id, bodyObject(req));
    res.status(result.status).json(result.body);
  });

  app.delete("/api/stay-registrations/:id", async (req: Request, res: Response) => {
    const result = await deleteStayRegistration(prisma, req.params.id);
    res.status(result.status).json(result.body);
  });

  app.post("/api/stay-registrations/:id/retry-drive-folder", async (req: Request, res: Response) => {
    const result = await retryDriveFolder(prisma, req.params.id);
    res.status(result.status).json(result.body);
  });
}
