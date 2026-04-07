import { z } from "zod";

export const delegationLevelSchema = z.number().int().min(1).max(5);
export const delegationScopeSchema = z.string().trim().min(1).max(100);
export const delegationSessionStatusSchema = z.enum(["open", "resolved", "cancelled"]);

// --- Delegation Agreements ---

export const createDelegationAgreementSchema = z.object({
  agentId: z.string().uuid(),
  scope: delegationScopeSchema.default("all"),
  level: delegationLevelSchema,
  notes: z.string().trim().max(2000).optional(),
  sessionId: z.string().uuid().optional(),
});

export type CreateDelegationAgreement = z.infer<typeof createDelegationAgreementSchema>;

export const updateDelegationAgreementSchema = z.object({
  level: delegationLevelSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type UpdateDelegationAgreement = z.infer<typeof updateDelegationAgreementSchema>;

// --- Delegation Poker Sessions ---

export const createDelegationSessionSchema = z.object({
  agentId: z.string().uuid(),
  scope: delegationScopeSchema.default("all"),
  proposedLevel: delegationLevelSchema.optional(),
  participants: z.array(z.string()).max(20).default([]),
});

export type CreateDelegationSession = z.infer<typeof createDelegationSessionSchema>;

export const resolveDelegationSessionSchema = z.object({
  finalLevel: delegationLevelSchema,
  notes: z.string().trim().max(2000).optional(),
});

export type ResolveDelegationSession = z.infer<typeof resolveDelegationSessionSchema>;

// --- Delegation Poker Votes ---

export const castDelegationVoteSchema = z.object({
  level: delegationLevelSchema,
  rationale: z.string().trim().max(2000).optional(),
});

export type CastDelegationVote = z.infer<typeof castDelegationVoteSchema>;
