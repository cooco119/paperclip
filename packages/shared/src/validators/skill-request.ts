import { z } from "zod";

export const skillRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "installed",
  "cancelled",
]);

export const createSkillRequestSchema = z.object({
  skillSource: z.string().trim().min(1).max(500),
  skillName: z.string().trim().min(1).max(200),
  skillDescription: z.string().trim().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateSkillRequest = z.infer<typeof createSkillRequestSchema>;

export const resolveSkillRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  decisionNote: z.string().trim().max(2000).optional(),
});
export type ResolveSkillRequest = z.infer<typeof resolveSkillRequestSchema>;

export const createSkillPolicySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  enabled: z.boolean().default(true),
  matchSourceType: z.string().trim().max(50).optional(),
  matchSourcePattern: z.string().trim().max(500).optional(),
  matchTrustLevel: z.enum(["markdown_only", "assets", "scripts_executables"]).optional(),
  matchAgentRoles: z.array(z.string().trim().max(100)).max(20).optional(),
});
export type CreateSkillPolicy = z.infer<typeof createSkillPolicySchema>;

export const updateSkillPolicySchema = createSkillPolicySchema.partial();
export type UpdateSkillPolicy = z.infer<typeof updateSkillPolicySchema>;
