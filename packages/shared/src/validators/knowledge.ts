import { z } from "zod";

export const knowledgeTypeSchema = z.enum(["learning", "pattern", "failure"]);

export const createKnowledgeSchema = z.object({
  type: knowledgeTypeSchema,
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  applicableTo: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  sourceAgentId: z.string().uuid().optional(),
  sourceIssueId: z.string().uuid().optional(),
});

export type CreateKnowledge = z.infer<typeof createKnowledgeSchema>;

export const updateKnowledgeSchema = createKnowledgeSchema.partial();

export type UpdateKnowledge = z.infer<typeof updateKnowledgeSchema>;
