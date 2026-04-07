import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

/**
 * Current delegation level per agent per scope.
 * Levels follow Jurgen Appelo's Delegation Poker model (Management 3.0):
 *   1 = Tell, 2 = Sell, 3 = Consult, 4 = Agree, 5 = Delegate
 */
export const delegationAgreements = pgTable(
  "delegation_agreements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    scope: text("scope").notNull().default("all"),
    level: integer("level").notNull(),
    decidedByUserId: text("decided_by_user_id"),
    decidedByAgentId: uuid("decided_by_agent_id").references(() => agents.id),
    sessionId: uuid("session_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentScopeIdx: index("delegation_agreements_company_agent_scope_idx").on(
      table.companyId,
      table.agentId,
      table.scope,
    ),
    agentIdx: index("delegation_agreements_agent_idx").on(table.agentId),
  }),
);
