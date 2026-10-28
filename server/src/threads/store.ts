import type { Message } from "@ag-ui/core";
import { z } from "zod";
import { and, asc, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "../db/index.ts";
import { messages, threads } from "../db/schema.ts";

export type Thread = typeof threads.$inferSelect;

export class ThreadBusyError extends Error {
  constructor(threadId: string) {
    super(`Thread ${threadId} already has a run in progress`);
    this.name = "ThreadBusyError";
  }
}

export interface ThreadStoreOptions {
  /** After this long a lock is considered abandoned by a crashed run. */
  lockTimeoutMs?: number;
  now?: () => Date;
}

export function createThreadStore(db: Database, { lockTimeoutMs = 10 * 60_000, now = () => new Date() }: ThreadStoreOptions = {}) {
  return {
    async create(input: { ownerId: string; botId: string; title?: string }): Promise<Thread> {
      // One clock, the store's, for every timestamp it orders by.
      const createdAt = now();
      const [thread] = await db
        .insert(threads)
        .values({ ...input, createdAt, updatedAt: createdAt })
        .returning();
      if (!thread) throw new Error("thread not created");
      return thread;
    },

    list(ownerId: string): Promise<Thread[]> {
      return db.select().from(threads).where(eq(threads.ownerId, ownerId)).orderBy(desc(threads.updatedAt));
    },

    /** The thread only when it belongs to ownerId; anyone else gets null, as if it did not exist. */
    async get(ownerId: string, threadId: string): Promise<Thread | null> {
      if (!z.uuid().safeParse(threadId).success) return null;
      const [thread] = await db
        .select()
        .from(threads)
        .where(and(eq(threads.id, threadId), eq(threads.ownerId, ownerId)));
      return thread ?? null;
    },

    async touch(threadId: string): Promise<void> {
      await db.update(threads).set({ updatedAt: now() }).where(eq(threads.id, threadId));
    },

    /** Adds messages in order; a message re-sent with the same id replaces the stored one in place. */
    async append(threadId: string, newMessages: Message[]): Promise<void> {
      if (newMessages.length === 0) return;
      await db
        .insert(messages)
        .values(newMessages.map((message) => ({ threadId, id: message.id, message })))
        .onConflictDoUpdate({ target: [messages.threadId, messages.id], set: { message: sql`excluded.message` } });
    },

    async history(threadId: string): Promise<Message[]> {
      const rows = await db
        .select({ message: messages.message })
        .from(messages)
        .where(eq(messages.threadId, threadId))
        .orderBy(asc(messages.position));
      return rows.map((row) => row.message);
    },

    /** Claims the thread for runId, or throws ThreadBusyError. Resolves to the release function. */
    async lock(threadId: string, runId: string): Promise<() => Promise<void>> {
      const startedAt = now();
      const staleBefore = new Date(startedAt.getTime() - lockTimeoutMs);
      const claimed = await db
        .update(threads)
        .set({ activeRunId: runId, activeRunStartedAt: startedAt })
        .where(and(eq(threads.id, threadId), or(isNull(threads.activeRunId), lt(threads.activeRunStartedAt, staleBefore))))
        .returning({ id: threads.id });
      if (claimed.length === 0) throw new ThreadBusyError(threadId);

      return async () => {
        await db
          .update(threads)
          .set({ activeRunId: null, activeRunStartedAt: null })
          .where(and(eq(threads.id, threadId), eq(threads.activeRunId, runId)));
      };
    },
  };
}

export type ThreadStore = ReturnType<typeof createThreadStore>;
