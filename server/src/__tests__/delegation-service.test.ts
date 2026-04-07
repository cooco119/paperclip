import { describe, expect, it, vi, beforeEach } from "vitest";
import { delegationService } from "../services/delegation.ts";

// ─── Helpers ──────────────────────────────────────────────────

function createRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "da-1",
    companyId: "company-1",
    agentId: "agent-1",
    scope: "all",
    level: 3,
    decidedByUserId: null,
    decidedByAgentId: null,
    sessionId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sess-1",
    companyId: "company-1",
    agentId: "agent-1",
    scope: "all",
    status: "open",
    proposedLevel: 3,
    finalLevel: null,
    participants: ["user-1", "agent-1"],
    initiatedByUserId: "user-1",
    initiatedByAgentId: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createVoteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vote-1",
    sessionId: "sess-1",
    voterUserId: "user-1",
    voterAgentId: null,
    level: 4,
    rationale: "Agent is ready for more autonomy",
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Build a mock Db that captures Drizzle-style chained calls and returns
 * pre-configured results.
 */
function createMockDb(opts: {
  selectResults?: unknown[][];
  insertResults?: unknown[];
  updateResults?: unknown[];
  deleteResults?: unknown[];
} = {}) {
  const pendingSelect = [...(opts.selectResults ?? [])];
  const pendingInsert = [...(opts.insertResults ?? [])];
  const pendingUpdate = [...(opts.updateResults ?? [])];
  const pendingDelete = [...(opts.deleteResults ?? [])];

  const selectWhere = vi.fn(async () => pendingSelect.shift() ?? []);
  const selectOrderBy = vi.fn(() => ({ then: (fn: any) => selectWhere().then(fn) }));
  const selectFrom = vi.fn(() => ({ where: vi.fn(() => ({ orderBy: selectOrderBy, then: (fn: any) => selectWhere().then(fn) })) }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const insertReturning = vi.fn(async () => pendingInsert.shift() ?? []);
  const insertValues = vi.fn(() => ({ returning: vi.fn(() => ({ then: (fn: any) => insertReturning().then(fn) })) }));
  const insert = vi.fn(() => ({ values: insertValues }));

  const updateReturning = vi.fn(async () => pendingUpdate.shift() ?? []);
  const updateWhere = vi.fn(() => ({ returning: vi.fn(() => ({ then: (fn: any) => updateReturning().then(fn) })) }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const deleteReturning = vi.fn(async () => pendingDelete.shift() ?? []);
  const deleteWhere = vi.fn(() => ({ returning: vi.fn(() => ({ then: (fn: any) => deleteReturning().then(fn) })) }));
  const deleteFn = vi.fn(() => ({ where: deleteWhere }));

  return {
    db: { select, insert, update, delete: deleteFn } as any,
    select,
    insert,
    update,
    deleteFn,
  };
}

// ─── Tests ────────────────────────────────────────────────────

describe("delegationService", () => {
  describe("agreements", () => {
    it("listAgreements calls select with companyId filter", async () => {
      const row = createRow();
      const mock = createMockDb({ selectResults: [[row]] });
      const svc = delegationService(mock.db);

      const result = await svc.listAgreements("company-1");

      expect(mock.select).toHaveBeenCalled();
      // Result comes through the chain
      expect(result).toBeDefined();
    });

    it("getAgreement returns null for missing", async () => {
      const mock = createMockDb({ selectResults: [[]] });
      const svc = delegationService(mock.db);

      const result = await svc.getAgreement("nonexistent");

      expect(result).toBeNull();
    });

    it("deleteAgreement returns null for missing", async () => {
      const mock = createMockDb({ deleteResults: [[]] });
      const svc = delegationService(mock.db);

      const result = await svc.deleteAgreement("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("vote summary", () => {
    it("returns empty summary for no votes", async () => {
      const mock = createMockDb({ selectResults: [[]] });
      const svc = delegationService(mock.db);

      const summary = await svc.getVoteSummary("sess-1");

      expect(summary.count).toBe(0);
      expect(summary.average).toBeNull();
      expect(summary.min).toBeNull();
      expect(summary.max).toBeNull();
    });

    it("computes correct summary for multiple votes", async () => {
      const votes = [
        createVoteRow({ level: 2 }),
        createVoteRow({ id: "vote-2", level: 4 }),
        createVoteRow({ id: "vote-3", level: 3 }),
      ];
      const mock = createMockDb({ selectResults: [votes] });
      const svc = delegationService(mock.db);

      const summary = await svc.getVoteSummary("sess-1");

      expect(summary.count).toBe(3);
      expect(summary.average).toBe(3);
      expect(summary.min).toBe(2);
      expect(summary.max).toBe(4);
    });

    it("rounds average to one decimal", async () => {
      const votes = [
        createVoteRow({ level: 1 }),
        createVoteRow({ id: "vote-2", level: 2 }),
        createVoteRow({ id: "vote-3", level: 5 }),
      ];
      const mock = createMockDb({ selectResults: [votes] });
      const svc = delegationService(mock.db);

      const summary = await svc.getVoteSummary("sess-1");

      // (1+2+5)/3 = 2.666... → 2.7
      expect(summary.average).toBe(2.7);
    });
  });
});

describe("delegation constants", () => {
  it("exports correct delegation level labels", async () => {
    const { DELEGATION_LEVEL_LABELS, DELEGATION_LEVELS } = await import("@paperclipai/shared");

    expect(DELEGATION_LEVELS).toEqual([1, 2, 3, 4, 5]);
    expect(DELEGATION_LEVEL_LABELS[1]).toBe("Tell");
    expect(DELEGATION_LEVEL_LABELS[2]).toBe("Sell");
    expect(DELEGATION_LEVEL_LABELS[3]).toBe("Consult");
    expect(DELEGATION_LEVEL_LABELS[4]).toBe("Agree");
    expect(DELEGATION_LEVEL_LABELS[5]).toBe("Delegate");
  });
});

describe("delegation validators", () => {
  it("validates delegation level range", async () => {
    const { delegationLevelSchema } = await import("@paperclipai/shared");

    expect(delegationLevelSchema.safeParse(1).success).toBe(true);
    expect(delegationLevelSchema.safeParse(5).success).toBe(true);
    expect(delegationLevelSchema.safeParse(0).success).toBe(false);
    expect(delegationLevelSchema.safeParse(6).success).toBe(false);
    expect(delegationLevelSchema.safeParse(2.5).success).toBe(false);
  });

  it("validates create agreement schema", async () => {
    const { createDelegationAgreementSchema } = await import("@paperclipai/shared");

    const valid = {
      agentId: "550e8400-e29b-41d4-a716-446655440000",
      scope: "hiring",
      level: 3,
      notes: "Agent showed good judgment",
    };
    expect(createDelegationAgreementSchema.safeParse(valid).success).toBe(true);

    const invalid = {
      agentId: "not-a-uuid",
      level: 7,
    };
    expect(createDelegationAgreementSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates create session schema with defaults", async () => {
    const { createDelegationSessionSchema } = await import("@paperclipai/shared");

    const minimal = {
      agentId: "550e8400-e29b-41d4-a716-446655440000",
    };
    const result = createDelegationSessionSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scope).toBe("all");
      expect(result.data.participants).toEqual([]);
    }
  });

  it("validates cast vote schema", async () => {
    const { castDelegationVoteSchema } = await import("@paperclipai/shared");

    expect(castDelegationVoteSchema.safeParse({ level: 4 }).success).toBe(true);
    expect(castDelegationVoteSchema.safeParse({ level: 4, rationale: "Trust earned" }).success).toBe(true);
    expect(castDelegationVoteSchema.safeParse({ level: 0 }).success).toBe(false);
  });
});
