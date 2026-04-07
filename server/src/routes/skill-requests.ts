import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createSkillRequestSchema,
  resolveSkillRequestSchema,
  createSkillPolicySchema,
  updateSkillPolicySchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { accessService, agentService, companySkillService, skillRequestService, logActivity } from "../services/index.js";
import { forbidden } from "../errors.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function skillRequestRoutes(db: Db) {
  const router = Router();
  const svc = skillRequestService(db);
  const agents = agentService(db);
  const access = accessService(db);
  const skillSvc = companySkillService(db);

  // Helper: check if actor can manage skill requests/policies (manager or board with agents:create)
  async function assertCanManageSkills(req: import("express").Request, companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") {
      if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return;
      const allowed = await access.canUser(companyId, req.actor.userId, "agents:create");
      if (!allowed) throw forbidden("Missing permission: agents:create");
      return;
    }
    if (!req.actor.agentId) throw forbidden("Agent authentication required");
    const actorAgent = await agents.getById(req.actor.agentId);
    if (!actorAgent || actorAgent.companyId !== companyId) {
      throw forbidden("Agent cannot access another company");
    }
    const allowedByGrant = await access.hasPermission(companyId, "agent", actorAgent.id, "agents:create");
    const canCreate = actorAgent.permissions && typeof actorAgent.permissions === "object"
      ? Boolean((actorAgent.permissions as Record<string, unknown>).canCreateAgents)
      : false;
    if (!allowedByGrant && !canCreate) {
      throw forbidden("Missing permission to manage skill requests");
    }
  }

  // ── Skill Requests ──

  // List skill requests
  router.get("/companies/:companyId/skill-requests", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;
    const result = await svc.list(companyId, { status, agentId });
    res.json(result);
  });

  // Get single request
  router.get("/companies/:companyId/skill-requests/:requestId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.getById(req.params.requestId as string);
    if (!result || result.companyId !== companyId) {
      res.status(404).json({ error: "Skill request not found" });
      return;
    }
    res.json(result);
  });

  // Agent creates a skill install request
  router.post(
    "/companies/:companyId/skill-requests",
    validate(createSkillRequestSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      if (!req.actor.agentId) {
        res.status(403).json({ error: "Only agents can create skill requests" });
        return;
      }
      const result = await svc.create(companyId, req.actor.agentId, req.body);

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "skill_request.created",
        entityType: "skill_request",
        entityId: result.id,
        details: {
          skillSource: result.skillSource,
          skillName: result.skillName,
          status: result.status,
        },
      });

      res.status(201).json(result);
    },
  );

  // Manager/board resolves a request
  router.post(
    "/companies/:companyId/skill-requests/:requestId/resolve",
    validate(resolveSkillRequestSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      await assertCanManageSkills(req, companyId);
      const actor = getActorInfo(req);
      const result = await svc.resolve(
        req.params.requestId as string,
        req.body.action,
        { agentId: actor.agentId ?? undefined, userId: actor.actorType === "user" ? actor.actorId : undefined },
        req.body.decisionNote,
      );

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: `skill_request.${req.body.action}d`,
        entityType: "skill_request",
        entityId: result.id,
        details: {
          skillSource: result.skillSource,
          skillName: result.skillName,
          status: result.status,
        },
      });

      res.json(result);
    },
  );

  // Agent cancels own request
  router.post("/companies/:companyId/skill-requests/:requestId/cancel", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    if (!req.actor.agentId) {
      res.status(403).json({ error: "Only agents can cancel skill requests" });
      return;
    }
    const result = await svc.cancel(req.params.requestId as string, req.actor.agentId);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "skill_request.cancelled",
      entityType: "skill_request",
      entityId: result.id,
      details: { skillName: result.skillName },
    });

    res.json(result);
  });

  // ── Skill Policies ──

  router.get("/companies/:companyId/skill-policies", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.listPolicies(companyId);
    res.json(result);
  });

  router.post(
    "/companies/:companyId/skill-policies",
    validate(createSkillPolicySchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      await assertCanManageSkills(req, companyId);
      const result = await svc.createPolicy(companyId, req.body);

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "skill_policy.created",
        entityType: "skill_policy",
        entityId: result.id,
        details: { name: result.name },
      });

      res.status(201).json(result);
    },
  );

  router.patch(
    "/companies/:companyId/skill-policies/:policyId",
    validate(updateSkillPolicySchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      await assertCanManageSkills(req, companyId);
      const existing = await svc.getPolicy(req.params.policyId as string);
      if (!existing || existing.companyId !== companyId) {
        res.status(404).json({ error: "Skill policy not found" });
        return;
      }
      const result = await svc.updatePolicy(req.params.policyId as string, req.body);

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "skill_policy.updated",
        entityType: "skill_policy",
        entityId: result.id,
        details: { name: result.name },
      });

      res.json(result);
    },
  );

  router.delete("/companies/:companyId/skill-policies/:policyId", async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertCanManageSkills(req, companyId);
    const existing = await svc.getPolicy(req.params.policyId as string);
    if (!existing || existing.companyId !== companyId) {
      res.status(404).json({ error: "Skill policy not found" });
      return;
    }
    const result = await svc.deletePolicy(req.params.policyId as string);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "skill_policy.deleted",
      entityType: "skill_policy",
      entityId: result.id,
      details: { name: result.name },
    });

    res.json(result);
  });

  // ── Agent Self-Update ──

  router.post("/agents/:agentId/skills/:skillId/self-update", async (req, res) => {
    if (!req.actor.agentId) {
      res.status(403).json({ error: "Only agents can self-update skills" });
      return;
    }
    const agentId = req.params.agentId as string;
    if (req.actor.agentId !== agentId) {
      res.status(403).json({ error: "Agents can only update their own skills" });
      return;
    }
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    const skillId = req.params.skillId as string;
    const result = await skillSvc.installUpdate(agent.companyId, skillId);
    if (!result) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "skill.self_updated",
      entityType: "company_skill",
      entityId: result.id,
      details: { slug: result.slug, sourceRef: result.sourceRef },
    });

    res.json(result);
  });

  return router;
}
