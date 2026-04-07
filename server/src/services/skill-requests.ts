import { and, eq, desc, asc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { skillRequests, skillPolicies } from "@paperclipai/db";
import { notFound, unprocessable } from "../errors.js";
import { companySkillService } from "./company-skills.js";
import { agentService } from "./agents.js";

export function skillRequestService(db: Db) {
  const skillSvc = companySkillService(db);
  const agentSvc = agentService(db);

  // ── Policy helpers ──

  function matchesPolicy(
    policy: typeof skillPolicies.$inferSelect,
    request: { skillSource: string },
    agentRole: string | null,
  ): boolean {
    if (policy.matchSourceType) {
      const sourcePrefix = request.skillSource.split(":")[0];
      if (sourcePrefix !== policy.matchSourceType) return false;
    }
    if (policy.matchSourcePattern) {
      const source = request.skillSource;
      if (!source.startsWith(policy.matchSourcePattern)) return false;
    }
    if (policy.matchAgentRoles && agentRole) {
      const roles = policy.matchAgentRoles as string[];
      if (roles.length > 0 && !roles.includes(agentRole)) return false;
    }
    return true;
  }

  async function checkAutoApproval(
    companyId: string,
    request: { skillSource: string },
    agentRole: string | null,
  ): Promise<typeof skillPolicies.$inferSelect | null> {
    const policies = await db
      .select()
      .from(skillPolicies)
      .where(and(eq(skillPolicies.companyId, companyId), eq(skillPolicies.enabled, true)));

    for (const policy of policies) {
      if (matchesPolicy(policy, request, agentRole)) {
        return policy;
      }
    }
    return null;
  }

  // ── Skill Request methods ──

  return {
    // List requests for a company, optionally filtered
    list: async (companyId: string, filters?: { status?: string; agentId?: string }) => {
      const conditions = [eq(skillRequests.companyId, companyId)];
      if (filters?.status) conditions.push(eq(skillRequests.status, filters.status));
      if (filters?.agentId) conditions.push(eq(skillRequests.requestedByAgentId, filters.agentId));
      return db
        .select()
        .from(skillRequests)
        .where(and(...conditions))
        .orderBy(desc(skillRequests.createdAt));
    },

    getById: async (id: string) => {
      const row = await db
        .select()
        .from(skillRequests)
        .where(eq(skillRequests.id, id))
        .then((rows) => rows[0] ?? null);
      return row;
    },

    // Agent creates a skill install request
    create: async (
      companyId: string,
      agentId: string,
      data: { skillSource: string; skillName: string; skillDescription?: string; metadata?: Record<string, unknown> },
    ) => {
      const agent = await agentSvc.getById(agentId);
      const agentRole = agent?.role ?? null;

      // Check auto-approval policies
      const matchedPolicy = await checkAutoApproval(companyId, data, agentRole);
      const now = new Date();

      const [created] = await db
        .insert(skillRequests)
        .values({
          companyId,
          requestedByAgentId: agentId,
          skillSource: data.skillSource,
          skillName: data.skillName,
          skillDescription: data.skillDescription ?? null,
          status: matchedPolicy ? "approved" : "pending",
          decidedAt: matchedPolicy ? now : null,
          metadata: {
            ...data.metadata,
            ...(matchedPolicy ? { autoApprovedByPolicyId: matchedPolicy.id, autoApprovedByPolicyName: matchedPolicy.name } : {}),
          },
        })
        .returning();

      // If auto-approved, try to import and install the skill
      if (matchedPolicy && created) {
        try {
          const importResult = await skillSvc.importFromSource(companyId, data.skillSource);
          if (importResult.imported.length > 0) {
            const importedSkill = importResult.imported[0];
            await db
              .update(skillRequests)
              .set({
                status: "installed",
                resolvedSkillId: importedSkill.id,
                updatedAt: now,
              })
              .where(eq(skillRequests.id, created.id));
            created.status = "installed";
            created.resolvedSkillId = importedSkill.id;
          }
        } catch {
          // Import failed — keep as approved, agent or manager can retry
        }
      }

      return created;
    },

    // Manager/board resolves a pending request
    resolve: async (
      id: string,
      action: "approve" | "reject",
      actor: { agentId?: string; userId?: string },
      decisionNote?: string,
    ) => {
      const existing = await db
        .select()
        .from(skillRequests)
        .where(eq(skillRequests.id, id))
        .then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Skill request not found");
      if (existing.status !== "pending") {
        throw unprocessable("Only pending requests can be resolved");
      }

      const now = new Date();
      const newStatus = action === "approve" ? "approved" : "rejected";

      const [updated] = await db
        .update(skillRequests)
        .set({
          status: newStatus,
          decisionNote: decisionNote ?? null,
          decidedByAgentId: actor.agentId ?? null,
          decidedByUserId: actor.userId ?? null,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(skillRequests.id, id))
        .returning();

      // If approved, import the skill
      if (action === "approve" && updated) {
        try {
          const importResult = await skillSvc.importFromSource(updated.companyId, updated.skillSource);
          if (importResult.imported.length > 0) {
            const importedSkill = importResult.imported[0];
            await db
              .update(skillRequests)
              .set({
                status: "installed",
                resolvedSkillId: importedSkill.id,
                updatedAt: now,
              })
              .where(eq(skillRequests.id, id));
            updated.status = "installed";
            updated.resolvedSkillId = importedSkill.id;
          }
        } catch {
          // Import failed — keep as approved
        }
      }

      return updated;
    },

    // Agent cancels own pending request
    cancel: async (id: string, agentId: string) => {
      const existing = await db
        .select()
        .from(skillRequests)
        .where(eq(skillRequests.id, id))
        .then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Skill request not found");
      if (existing.requestedByAgentId !== agentId) {
        throw unprocessable("Can only cancel your own requests");
      }
      if (existing.status !== "pending") {
        throw unprocessable("Only pending requests can be cancelled");
      }

      const [updated] = await db
        .update(skillRequests)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(skillRequests.id, id))
        .returning();
      return updated;
    },

    // ── Policy CRUD ──

    listPolicies: async (companyId: string) => {
      return db
        .select()
        .from(skillPolicies)
        .where(eq(skillPolicies.companyId, companyId))
        .orderBy(asc(skillPolicies.createdAt));
    },

    getPolicy: async (id: string) => {
      return db
        .select()
        .from(skillPolicies)
        .where(eq(skillPolicies.id, id))
        .then((rows) => rows[0] ?? null);
    },

    createPolicy: async (
      companyId: string,
      data: {
        name: string;
        description?: string;
        enabled?: boolean;
        matchSourceType?: string;
        matchSourcePattern?: string;
        matchTrustLevel?: string;
        matchAgentRoles?: string[];
      },
    ) => {
      const [created] = await db
        .insert(skillPolicies)
        .values({
          companyId,
          name: data.name,
          description: data.description ?? null,
          enabled: data.enabled ?? true,
          matchSourceType: data.matchSourceType ?? null,
          matchSourcePattern: data.matchSourcePattern ?? null,
          matchTrustLevel: data.matchTrustLevel ?? null,
          matchAgentRoles: data.matchAgentRoles ?? null,
        })
        .returning();
      return created;
    },

    updatePolicy: async (id: string, data: Record<string, unknown>) => {
      const existing = await db
        .select()
        .from(skillPolicies)
        .where(eq(skillPolicies.id, id))
        .then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Skill policy not found");

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (data.name !== undefined) updates.name = data.name;
      if (data.description !== undefined) updates.description = data.description;
      if (data.enabled !== undefined) updates.enabled = data.enabled;
      if (data.matchSourceType !== undefined) updates.matchSourceType = data.matchSourceType;
      if (data.matchSourcePattern !== undefined) updates.matchSourcePattern = data.matchSourcePattern;
      if (data.matchTrustLevel !== undefined) updates.matchTrustLevel = data.matchTrustLevel;
      if (data.matchAgentRoles !== undefined) updates.matchAgentRoles = data.matchAgentRoles;

      const [updated] = await db
        .update(skillPolicies)
        .set(updates)
        .where(eq(skillPolicies.id, id))
        .returning();
      return updated;
    },

    deletePolicy: async (id: string) => {
      const existing = await db
        .select()
        .from(skillPolicies)
        .where(eq(skillPolicies.id, id))
        .then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Skill policy not found");

      await db.delete(skillPolicies).where(eq(skillPolicies.id, id));
      return existing;
    },
  };
}
