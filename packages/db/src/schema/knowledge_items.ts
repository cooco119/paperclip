import { pgTable, uuid, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";

export const knowledgeItems = pgTable(
  "knowledge_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    type: text("type").notNull(), // 'learning' | 'pattern' | 'failure'
    title: text("title").notNull(),
    body: text("body").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    applicableTo: jsonb("applicable_to").$type<string[]>().notNull().default([]),
    sourceAgentId: uuid("source_agent_id").references(() => agents.id),
    sourceIssueId: uuid("source_issue_id").references(() => issues.id),
    usedCount: integer("used_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyTypeIdx: index("knowledge_items_company_type_idx").on(table.companyId, table.type),
    companyAgentIdx: index("knowledge_items_company_agent_idx").on(table.companyId, table.sourceAgentId),
    companyUpdatedIdx: index("knowledge_items_company_updated_idx").on(table.companyId, table.updatedAt),
  }),
);
