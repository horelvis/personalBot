import type { Message } from "@ag-ui/core";
import { bigserial, index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const threads = pgTable(
  "threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    botId: text("bot_id").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // One run at a time per thread; a run that crashed is taken over once its lock is stale.
    activeRunId: text("active_run_id"),
    activeRunStartedAt: timestamp("active_run_started_at", { withTimezone: true }),
  },
  (table) => [index("threads_owner_updated_idx").on(table.ownerId, table.updatedAt)],
);

/** AG-UI messages, stored as sent so any AG-UI agent can receive the history back unchanged. */
export const messages = pgTable(
  "messages",
  {
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    position: bigserial("position", { mode: "number" }).notNull(),
    message: jsonb("message").$type<Message>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.threadId, table.id] }), index("messages_thread_position_idx").on(table.threadId, table.position)],
);
