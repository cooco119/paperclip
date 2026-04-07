import { pgTable, uuid, text, timestamp, jsonb, index, boolean } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const skillPolicies = pgTable(
  "skill_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(true),
    matchSourceType: text("match_source_type"),
    matchSourcePattern: text("match_source_pattern"),
    matchTrustLevel: text("match_trust_level"),
    matchAgentRoles: jsonb("match_agent_roles").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("skill_policies_company_idx").on(table.companyId),
  }),
);
