import type { Express, Request, Response } from "express";
import type { StayExperiencePrisma } from "../services/stay-experience-service.js";
import { createStayExperience, deleteStayExperience, getStayExperienceById, listStayExperiences, updateStayExperience } from "../services/stay-experience-service.js";

function bodyObject(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body as Record<string, unknown> : {};
}

function queryString(req: Request, key: string): string | undefined {
  return typeof req.query[key] === "string" ? req.query[key] : undefined;
}

export function registerStayExperienceRoutes(app: Express, prisma: StayExperiencePrisma): void {
  app.post("/api/stay-experiences", async (req: Request, res: Response) => {
    const result = await createStayExperience(prisma, bodyObject(req));
    res.status(result.status).json(result.body);
  });
  app.get("/api/stay-experiences", async (req: Request, res: Response) => {
    const result = await listStayExperiences(prisma, {
      property_id: queryString(req, "property_id"),
      reservation_id: queryString(req, "reservation_id"),
      stay_type: queryString(req, "stay_type"),
    });
    res.status(result.status).json(result.body);
  });
  app.get("/api/stay-experiences/:id", async (req: Request, res: Response) => {
    const result = await getStayExperienceById(prisma, req.params.id);
    res.status(result.status).json(result.body);
  });
  app.patch("/api/stay-experiences/:id", async (req: Request, res: Response) => {
    const result = await updateStayExperience(prisma, req.params.id, bodyObject(req));
    res.status(result.status).json(result.body);
  });
  app.delete("/api/stay-experiences/:id", async (req: Request, res: Response) => {
    const result = await deleteStayExperience(prisma, req.params.id);
    res.status(result.status).json(result.body);
  });
}
