import { type Express, type Request, type Response } from "express";
import { type TenantPrisma } from "../services/tenant-service.js";
import {
  createTenant,
  getTenantById,
  listTenants,
  updateTenant,
  archiveTenant,
} from "../services/tenant-service.js";

export function registerTenantRoutes(app: Express, prisma: TenantPrisma): void {
  // POST /api/tenants — create tenant
  app.post("/api/tenants", async (req: Request, res: Response) => {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};

    const result = await createTenant(prisma, body);
    res.status(result.status).json(result.body);
  });

  // GET /api/tenants — list tenants (no raw id_document_number)
  app.get("/api/tenants", async (req: Request, res: Response) => {
    const propertyId = typeof req.query.property_id === "string" ? req.query.property_id : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;
    const offset = typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : undefined;

    const result = await listTenants(prisma, {
      property_id: propertyId,
      limit: !limit || Number.isNaN(limit) ? undefined : limit,
      offset: !offset || Number.isNaN(offset) ? undefined : offset,
    });
    res.status(result.status).json(result.body);
  });

  // GET /api/tenants/:id — get single tenant (masked id_document_number)
  app.get("/api/tenants/:id", async (req: Request, res: Response) => {
    const result = await getTenantById(prisma, req.params.id);
    res.status(result.status).json(result.body);
  });

  // PUT /api/tenants/:id — update tenant
  app.put("/api/tenants/:id", async (req: Request, res: Response) => {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};

    const result = await updateTenant(prisma, req.params.id, body);
    res.status(result.status).json(result.body);
  });

  // DELETE /api/tenants/:id — soft archive
  app.delete("/api/tenants/:id", async (req: Request, res: Response) => {
    const result = await archiveTenant(prisma, req.params.id);
    res.status(result.status).json(result.body);
  });
}
