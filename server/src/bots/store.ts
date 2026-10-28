import { asc, eq } from "drizzle-orm";
import type { Database } from "../db/index.ts";
import { bots } from "../db/schema.ts";

export type Bot = typeof bots.$inferSelect;

export function createBotStore(db: Database) {
  return {
    async add(input: { id: string; name: string; url: string; description?: string }): Promise<Bot> {
      const [bot] = await db.insert(bots).values(input).returning();
      if (!bot) throw new Error("bot not created");
      return bot;
    },

    async get(id: string): Promise<Bot | null> {
      const [bot] = await db.select().from(bots).where(eq(bots.id, id));
      return bot ?? null;
    },

    list(): Promise<Bot[]> {
      return db.select().from(bots).orderBy(asc(bots.name));
    },
  };
}
