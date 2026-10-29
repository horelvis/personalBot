import { createHash, randomBytes } from "node:crypto";
import { and, eq, getTableColumns, gt, lte } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import type { Database } from "../db/index.ts";
import { sessions, users } from "../db/schema.ts";
import type { Identify, User } from "./identify.ts";

export const SESSION_COOKIE = "personalbot_session";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const hash = (token: string) => createHash("sha256").update(token).digest("base64url");

export function createSessionStore(db: Database, { now = () => new Date(), ttlMs = THIRTY_DAYS_MS } = {}) {
  return {
    ttlMs,

    /** A new opaque token for userId; the caller puts it in the cookie. */
    async create(userId: string): Promise<string> {
      const token = randomBytes(32).toString("base64url");
      // Cleans up as it goes, so expired rows do not pile up.
      await db.delete(sessions).where(and(eq(sessions.userId, userId), lte(sessions.expiresAt, now())));
      await db.insert(sessions).values({ tokenHash: hash(token), userId, expiresAt: new Date(now().getTime() + ttlMs) });
      return token;
    },

    async resolve(token: string): Promise<User | null> {
      const [row] = await db
        .select(getTableColumns(users))
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.tokenHash, hash(token)), gt(sessions.expiresAt, now())));
      return row ?? null;
    },

    async revoke(token: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.tokenHash, hash(token)));
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;

/** With adminEmails, the role follows that list on every request, so removing someone takes effect at once. */
export function sessionIdentify(store: SessionStore, { adminEmails }: { adminEmails?: string[] } = {}): Identify {
  return async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    const user = token ? await store.resolve(token) : null;
    if (!user || !adminEmails) return user;
    return { ...user, role: adminEmails.includes(user.email.toLowerCase()) ? "admin" : "member" };
  };
}
