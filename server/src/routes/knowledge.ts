import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createKnowledgeSchema, updateKnowledgeSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { knowledgeService, type KnowledgeFilters } from "../services/knowledge.js";
import { logActivity } from "../services/activity-log.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function knowledgeRoutes(db: Db) {
  const router = Router();
  const svc = knowledgeService(db);

  // List / search knowledge items for a company
  router.get("/companies/:companyId/knowledge", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const filters: KnowledgeFilters = {};
    if (typeof req.query.type === "string") {
      filters.type = req.query.type as KnowledgeFilters["type"];
    }
    if (typeof req.query.tags === "string") {
      filters.tags = req.query.tags.split(",").map((t) => t.trim()).filter(Boolean);
    }
    if (typeof req.query.q === "string" && req.query.q.trim().length > 0) {
      filters.q = req.query.q.trim();
    }

    const items = await svc.list(companyId, filters);
    res.json(items);
  });

  // Create a knowledge item
  router.post(
    "/companies/:companyId/knowledge",
    validate(createKnowledgeSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);

      const item = await svc.create(companyId, req.body);

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "knowledge.created",
        entityType: "knowledge_item",
        entityId: item.id,
        details: { title: item.title, type: item.type },
      });

      res.status(201).json(item);
    },
  );

  // Get a single knowledge item
  router.get("/knowledge/:id", async (req, res) => {
    const id = req.params.id as string;
    const item = await svc.getById(id);
    if (!item) {
      res.status(404).json({ error: "Knowledge item not found" });
      return;
    }
    assertCompanyAccess(req, item.companyId);
    res.json(item);
  });

  // Update a knowledge item
  router.patch(
    "/knowledge/:id",
    validate(updateKnowledgeSchema),
    async (req, res) => {
      const id = req.params.id as string;
      const existing = await svc.getById(id);
      if (!existing) {
        res.status(404).json({ error: "Knowledge item not found" });
        return;
      }
      assertCompanyAccess(req, existing.companyId);

      const updated = await svc.update(id, req.body);
      res.json(updated);
    },
  );

  // Delete a knowledge item
  router.delete("/knowledge/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Knowledge item not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    await svc.remove(id);
    res.json({ ok: true });
  });

  // Record usage of a knowledge item
  router.post("/knowledge/:id/record-usage", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Knowledge item not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const updated = await svc.recordUsage(id);
    res.json(updated);
  });

  return router;
}
