import type { Context } from "hono";
import type { users } from "../db/schema.ts";

export type User = typeof users.$inferSelect;

/** Resolves the person behind a request, or null when nobody is signed in. */
export type Identify = (c: Context) => Promise<User | null>;
