import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createDelegationAgreementSchema,
  updateDelegationAgreementSchema,
  createDelegationSessionSchema,
  resolveDelegationSessionSchema,
  castDelegationVoteSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { delegationService } from "../services/delegation.js";
import { logActivity } from "../services/activity-log.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function delegationRoutes(db: Db) {
  const router = Router();
  const svc = delegationService(db);

  // ─── Agreements ───────────────────────────────────────────────

  router.get("/companies/:companyId/delegation-agreements", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;
    const items = await svc.listAgreements(companyId, agentId);
    res.json(items);
  });

  router.post(
    "/companies/:companyId/delegation-agreements",
    validate(createDelegationAgreementSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);

      const agreement = await svc.upsertAgreement(companyId, {
        ...req.body,
        decidedByUserId: actor.actorType === "user" ? actor.actorId : undefined,
        decidedByAgentId: actor.actorType === "agent" ? actor.actorId : undefined,
      });

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "delegation.agreement_set",
        entityType: "delegation_agreement",
        entityId: agreement.id,
        details: { agentId: req.body.agentId, scope: req.body.scope, level: req.body.level },
      });

      res.status(201).json(agreement);
    },
  );

  router.get("/delegation-agreements/:id", async (req, res) => {
    const id = req.params.id as string;
    const agreement = await svc.getAgreement(id);
    if (!agreement) {
      res.status(404).json({ error: "Delegation agreement not found" });
      return;
    }
    assertCompanyAccess(req, agreement.companyId);
    res.json(agreement);
  });

  router.patch(
    "/delegation-agreements/:id",
    validate(updateDelegationAgreementSchema),
    async (req, res) => {
      const id = req.params.id as string;
      const existing = await svc.getAgreement(id);
      if (!existing) {
        res.status(404).json({ error: "Delegation agreement not found" });
        return;
      }
      assertCompanyAccess(req, existing.companyId);
      const actor = getActorInfo(req);

      const updated = await svc.upsertAgreement(existing.companyId, {
        agentId: existing.agentId,
        scope: existing.scope,
        level: req.body.level ?? existing.level,
        notes: req.body.notes,
        decidedByUserId: actor.actorType === "user" ? actor.actorId : undefined,
        decidedByAgentId: actor.actorType === "agent" ? actor.actorId : undefined,
      });

      res.json(updated);
    },
  );

  router.delete("/delegation-agreements/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getAgreement(id);
    if (!existing) {
      res.status(404).json({ error: "Delegation agreement not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    await svc.deleteAgreement(id);
    res.json({ ok: true });
  });

  // ─── Poker Sessions ──────────────────────────────────────────

  router.get("/companies/:companyId/delegation-sessions", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const sessions = await svc.listSessions(companyId, status);
    res.json(sessions);
  });

  router.post(
    "/companies/:companyId/delegation-sessions",
    validate(createDelegationSessionSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);

      const session = await svc.createSession(companyId, {
        ...req.body,
        initiatedByUserId: actor.actorType === "user" ? actor.actorId : undefined,
        initiatedByAgentId: actor.actorType === "agent" ? actor.actorId : undefined,
      });

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "delegation.session_started",
        entityType: "delegation_poker_session",
        entityId: session.id,
        details: { agentId: req.body.agentId, scope: req.body.scope },
      });

      res.status(201).json(session);
    },
  );

  router.get("/delegation-sessions/:id", async (req, res) => {
    const id = req.params.id as string;
    const session = await svc.getSession(id);
    if (!session) {
      res.status(404).json({ error: "Delegation session not found" });
      return;
    }
    assertCompanyAccess(req, session.companyId);
    res.json(session);
  });

  router.post(
    "/delegation-sessions/:id/resolve",
    validate(resolveDelegationSessionSchema),
    async (req, res) => {
      const id = req.params.id as string;
      const existing = await svc.getSession(id);
      if (!existing) {
        res.status(404).json({ error: "Delegation session not found" });
        return;
      }
      if (existing.status !== "open") {
        res.status(400).json({ error: `Session is ${existing.status}, cannot resolve` });
        return;
      }
      assertCompanyAccess(req, existing.companyId);
      const actor = getActorInfo(req);

      const session = await svc.resolveSession(
        id,
        req.body.finalLevel,
        actor.actorType === "user" ? actor.actorId : undefined,
        actor.actorType === "agent" ? actor.actorId : undefined,
      );

      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "delegation.session_resolved",
        entityType: "delegation_poker_session",
        entityId: id,
        details: { finalLevel: req.body.finalLevel, agentId: existing.agentId, scope: existing.scope },
      });

      res.json(session);
    },
  );

  router.post("/delegation-sessions/:id/cancel", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getSession(id);
    if (!existing) {
      res.status(404).json({ error: "Delegation session not found" });
      return;
    }
    if (existing.status !== "open") {
      res.status(400).json({ error: `Session is ${existing.status}, cannot cancel` });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const session = await svc.cancelSession(id);
    res.json(session);
  });

  // ─── Votes ───────────────────────────────────────────────────

  router.get("/delegation-sessions/:id/votes", async (req, res) => {
    const id = req.params.id as string;
    const session = await svc.getSession(id);
    if (!session) {
      res.status(404).json({ error: "Delegation session not found" });
      return;
    }
    assertCompanyAccess(req, session.companyId);

    const votes = await svc.listVotes(id);
    res.json(votes);
  });

  router.post(
    "/delegation-sessions/:id/votes",
    validate(castDelegationVoteSchema),
    async (req, res) => {
      const id = req.params.id as string;
      const session = await svc.getSession(id);
      if (!session) {
        res.status(404).json({ error: "Delegation session not found" });
        return;
      }
      if (session.status !== "open") {
        res.status(400).json({ error: `Session is ${session.status}, cannot vote` });
        return;
      }
      assertCompanyAccess(req, session.companyId);
      const actor = getActorInfo(req);

      const vote = await svc.castVote(id, {
        ...req.body,
        voterUserId: actor.actorType === "user" ? actor.actorId : undefined,
        voterAgentId: actor.actorType === "agent" ? actor.actorId : undefined,
      });

      res.status(201).json(vote);
    },
  );

  router.get("/delegation-sessions/:id/summary", async (req, res) => {
    const id = req.params.id as string;
    const session = await svc.getSession(id);
    if (!session) {
      res.status(404).json({ error: "Delegation session not found" });
      return;
    }
    assertCompanyAccess(req, session.companyId);

    const summary = await svc.getVoteSummary(id);
    res.json({ session, ...summary });
  });

  return router;
}
