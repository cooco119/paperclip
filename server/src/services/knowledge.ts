import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { knowledgeItems } from "@paperclipai/db";

export type KnowledgeType = "learning" | "pattern" | "failure";

export interface KnowledgeFilters {
  type?: KnowledgeType;
  tags?: string[];
  q?: string;
}

export function knowledgeService(db: Db) {
  return {
    list: (companyId: string, filters: KnowledgeFilters = {}) => {
      const conditions = [eq(knowledgeItems.companyId, companyId)];

      if (filters.type) {
        conditions.push(eq(knowledgeItems.type, filters.type));
      }

      if (filters.tags && filters.tags.length > 0) {
        // Match any item that has at least one of the requested tags
        conditions.push(
          sql`${knowledgeItems.tags} ?| array[${sql.join(
            filters.tags.map((t) => sql`${t}`),
            sql`, `,
          )}]`,
        );
      }

      if (filters.q) {
        conditions.push(
          or(
            ilike(knowledgeItems.title, `%${filters.q}%`),
            ilike(knowledgeItems.body, `%${filters.q}%`),
          )!,
        );
      }

      return db
        .select()
        .from(knowledgeItems)
        .where(and(...conditions))
        .orderBy(desc(knowledgeItems.updatedAt));
    },

    getById: (id: string) =>
      db
        .select()
        .from(knowledgeItems)
        .where(eq(knowledgeItems.id, id))
        .then((rows) => rows[0] ?? null),

    create: (
      companyId: string,
      data: Omit<typeof knowledgeItems.$inferInsert, "companyId">,
    ) =>
      db
        .insert(knowledgeItems)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]),

    update: (id: string, data: Partial<typeof knowledgeItems.$inferInsert>) =>
      db
        .update(knowledgeItems)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(knowledgeItems.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    remove: (id: string) =>
      db
        .delete(knowledgeItems)
        .where(eq(knowledgeItems.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    recordUsage: (id: string) =>
      db
        .update(knowledgeItems)
        .set({
          usedCount: sql`${knowledgeItems.usedCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeItems.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    getForHeartbeat: (companyId: string, applicableRoles: string[] = []) => {
      const conditions = [eq(knowledgeItems.companyId, companyId)];

      if (applicableRoles.length > 0) {
        // Items with empty applicableTo (universal) or matching roles
        conditions.push(
          or(
            sql`jsonb_array_length(${knowledgeItems.applicableTo}) = 0`,
            sql`${knowledgeItems.applicableTo} ?| array[${sql.join(
              applicableRoles.map((r) => sql`${r}`),
              sql`, `,
            )}]`,
          )!,
        );
      }

      return db
        .select({
          id: knowledgeItems.id,
          type: knowledgeItems.type,
          title: knowledgeItems.title,
          body: knowledgeItems.body,
          tags: knowledgeItems.tags,
        })
        .from(knowledgeItems)
        .where(and(...conditions))
        .orderBy(desc(knowledgeItems.usedCount), desc(knowledgeItems.updatedAt))
        .limit(5);
    },
  };
}
