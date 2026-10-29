import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../db/index.ts";
import { memories } from "../db/schema.ts";

export interface Memory {
  id: string;
  content: string;
  createdAt: Date;
}

const columns = { id: memories.id, content: memories.content, createdAt: memories.createdAt };

export function createMemoryStore(db: Database, { now = () => new Date() }: { now?: () => Date } = {}) {
  return {
    async add(ownerId: string, content: string): Promise<Memory> {
      const [memory] = await db.insert(memories).values({ ownerId, content, createdAt: now() }).returning(columns);
      if (!memory) throw new Error("memory not created");
      return memory;
    },

    list(ownerId: string, limit = 100): Promise<Memory[]> {
      return db.select(columns).from(memories).where(eq(memories.ownerId, ownerId)).orderBy(desc(memories.createdAt)).limit(limit);
    },

    /** True when the fact existed and belonged to ownerId. */
    async remove(ownerId: string, id: string): Promise<boolean> {
      const removed = await db
        .delete(memories)
        .where(and(eq(memories.id, id), eq(memories.ownerId, ownerId)))
        .returning({ id: memories.id });
      return removed.length > 0;
    },

    search(ownerId: string, query: string, limit = 10): Promise<Memory[]> {
      const matches = sql`websearch_to_tsquery('simple', ${query})`;
      return db
        .select(columns)
        .from(memories)
        .where(and(eq(memories.ownerId, ownerId), sql`${memories.search} @@ ${matches}`))
        .orderBy(desc(sql`ts_rank(${memories.search}, ${matches})`), desc(memories.createdAt))
        .limit(limit);
    },
  };
}

export type MemoryStore = ReturnType<typeof createMemoryStore>;
