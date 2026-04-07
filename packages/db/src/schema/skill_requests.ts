import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { companySkills } from "./company_skills.js";

export const skillRequests = pgTable(
  "skill_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    requestedByAgentId: uuid("requested_by_agent_id").notNull().references(() => agents.id),
    skillSource: text("skill_source").notNull(),
    skillName: text("skill_name").notNull(),
    skillDescription: text("skill_description"),
    status: text("status").notNull().default("pending"),
    approvalId: uuid("approval_id"),
    resolvedSkillId: uuid("resolved_skill_id").references(() => companySkills.id),
    decisionNote: text("decision_note"),
    decidedByAgentId: uuid("decided_by_agent_id").references(() => agents.id),
    decidedByUserId: text("decided_by_user_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("skill_requests_company_status_idx").on(table.companyId, table.status),
    agentIdx: index("skill_requests_agent_idx").on(table.requestedByAgentId),
  }),
);
