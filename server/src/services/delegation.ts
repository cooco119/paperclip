import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { delegationAgreements } from "@paperclipai/db";
import { delegationPokerSessions, delegationPokerVotes } from "@paperclipai/db";

export function delegationService(db: Db) {
  return {
    // ─── Agreements ───────────────────────────────────────────────

    listAgreements: (companyId: string, agentId?: string) => {
      const conditions = [eq(delegationAgreements.companyId, companyId)];
      if (agentId) conditions.push(eq(delegationAgreements.agentId, agentId));

      return db
        .select()
        .from(delegationAgreements)
        .where(and(...conditions))
        .orderBy(desc(delegationAgreements.updatedAt));
    },

    getAgreement: (id: string) =>
      db
        .select()
        .from(delegationAgreements)
        .where(eq(delegationAgreements.id, id))
        .then((rows) => rows[0] ?? null),

    getAgreementByAgentScope: (companyId: string, agentId: string, scope: string) =>
      db
        .select()
        .from(delegationAgreements)
        .where(
          and(
            eq(delegationAgreements.companyId, companyId),
            eq(delegationAgreements.agentId, agentId),
            eq(delegationAgreements.scope, scope),
          ),
        )
        .then((rows) => rows[0] ?? null),

    upsertAgreement: async (
      companyId: string,
      data: {
        agentId: string;
        scope: string;
        level: number;
        notes?: string;
        sessionId?: string;
        decidedByUserId?: string;
        decidedByAgentId?: string;
      },
    ) => {
      const existing = await db
        .select()
        .from(delegationAgreements)
        .where(
          and(
            eq(delegationAgreements.companyId, companyId),
            eq(delegationAgreements.agentId, data.agentId),
            eq(delegationAgreements.scope, data.scope),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (existing) {
        return db
          .update(delegationAgreements)
          .set({
            level: data.level,
            notes: data.notes ?? existing.notes,
            sessionId: data.sessionId,
            decidedByUserId: data.decidedByUserId,
            decidedByAgentId: data.decidedByAgentId,
            updatedAt: new Date(),
          })
          .where(eq(delegationAgreements.id, existing.id))
          .returning()
          .then((rows) => rows[0]);
      }

      return db
        .insert(delegationAgreements)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]);
    },

    deleteAgreement: (id: string) =>
      db
        .delete(delegationAgreements)
        .where(eq(delegationAgreements.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    // ─── Poker Sessions ──────────────────────────────────────────

    listSessions: (companyId: string, status?: string) => {
      const conditions = [eq(delegationPokerSessions.companyId, companyId)];
      if (status) conditions.push(eq(delegationPokerSessions.status, status));

      return db
        .select()
        .from(delegationPokerSessions)
        .where(and(...conditions))
        .orderBy(desc(delegationPokerSessions.updatedAt));
    },

    getSession: (id: string) =>
      db
        .select()
        .from(delegationPokerSessions)
        .where(eq(delegationPokerSessions.id, id))
        .then((rows) => rows[0] ?? null),

    createSession: (
      companyId: string,
      data: {
        agentId: string;
        scope: string;
        proposedLevel?: number;
        participants: string[];
        initiatedByUserId?: string;
        initiatedByAgentId?: string;
      },
    ) =>
      db
        .insert(delegationPokerSessions)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]),

    resolveSession: async (
      id: string,
      finalLevel: number,
      decidedByUserId?: string,
      decidedByAgentId?: string,
    ) => {
      const session = await db
        .update(delegationPokerSessions)
        .set({
          status: "resolved",
          finalLevel,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(delegationPokerSessions.id, id))
        .returning()
        .then((rows) => rows[0]);

      if (!session) return null;

      // Auto-create or update the delegation agreement
      const agreement = await db
        .select()
        .from(delegationAgreements)
        .where(
          and(
            eq(delegationAgreements.companyId, session.companyId),
            eq(delegationAgreements.agentId, session.agentId),
            eq(delegationAgreements.scope, session.scope),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (agreement) {
        await db
          .update(delegationAgreements)
          .set({
            level: finalLevel,
            sessionId: id,
            decidedByUserId,
            decidedByAgentId,
            updatedAt: new Date(),
          })
          .where(eq(delegationAgreements.id, agreement.id));
      } else {
        await db.insert(delegationAgreements).values({
          companyId: session.companyId,
          agentId: session.agentId,
          scope: session.scope,
          level: finalLevel,
          sessionId: id,
          decidedByUserId,
          decidedByAgentId,
        });
      }

      return session;
    },

    cancelSession: (id: string) =>
      db
        .update(delegationPokerSessions)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(delegationPokerSessions.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    // ─── Votes ───────────────────────────────────────────────────

    listVotes: (sessionId: string) =>
      db
        .select()
        .from(delegationPokerVotes)
        .where(eq(delegationPokerVotes.sessionId, sessionId))
        .orderBy(delegationPokerVotes.createdAt),

    castVote: (
      sessionId: string,
      data: {
        level: number;
        rationale?: string;
        voterUserId?: string;
        voterAgentId?: string;
      },
    ) =>
      db
        .insert(delegationPokerVotes)
        .values({ ...data, sessionId })
        .returning()
        .then((rows) => rows[0]),

    getVoteSummary: async (sessionId: string) => {
      const votes = await db
        .select()
        .from(delegationPokerVotes)
        .where(eq(delegationPokerVotes.sessionId, sessionId));

      if (votes.length === 0) return { count: 0, average: null, min: null, max: null, votes: [] };

      const levels = votes.map((v) => v.level);
      return {
        count: votes.length,
        average: Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10,
        min: Math.min(...levels),
        max: Math.max(...levels),
        votes,
      };
    },
  };
}
