import { pgTable, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

/**
 * A delegation poker session where participants vote on delegation level.
 */
export const delegationPokerSessions = pgTable(
  "delegation_poker_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    scope: text("scope").notNull().default("all"),
    status: text("status").notNull().default("open"),
    proposedLevel: integer("proposed_level"),
    finalLevel: integer("final_level"),
    participants: jsonb("participants").$type<string[]>().notNull().default([]),
    initiatedByUserId: text("initiated_by_user_id"),
    initiatedByAgentId: uuid("initiated_by_agent_id").references(() => agents.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("delegation_poker_sessions_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    agentIdx: index("delegation_poker_sessions_agent_idx").on(table.agentId),
  }),
);

/**
 * Individual vote in a delegation poker session.
 */
export const delegationPokerVotes = pgTable(
  "delegation_poker_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => delegationPokerSessions.id),
    voterUserId: text("voter_user_id"),
    voterAgentId: uuid("voter_agent_id").references(() => agents.id),
    level: integer("level").notNull(),
    rationale: text("rationale"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("delegation_poker_votes_session_idx").on(table.sessionId),
  }),
);
