import type { Message } from "@ag-ui/core";
import { sql } from "drizzle-orm";
import { bigserial, customType, index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

/** Bots are AG-UI endpoints reached by URL, whatever framework they are built with. */
export const bots = pgTable("bots", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

/** Facts each person's bots remember about them. */
export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // 'simple' does no language-specific stemming, so it treats every language the same.
    search: tsvector("search")
      .notNull()
      .generatedAlwaysAs(sql`to_tsvector('simple', content)`),
  },
  (table) => [
    index("memories_owner_created_idx").on(table.ownerId, table.createdAt),
    index("memories_search_idx").using("gin", table.search),
  ],
);

/** Allow/deny rules for the built-in assistant's tools; `*` matches every tool and deny wins. */
export const toolRules = pgTable("tool_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tool: text("tool").notNull(),
  effect: text("effect", { enum: ["allow", "deny"] }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per tool call, written with the gateway's decision before the tool acts. */
export const toolAudit = pgTable(
  "tool_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    threadId: text("thread_id").notNull(),
    runId: text("run_id").notNull(),
    tool: text("tool").notNull(),
    input: jsonb("input").notNull(),
    decision: text("decision", { enum: ["allow", "deny"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("tool_audit_user_created_idx").on(table.userId, table.createdAt)],
);
