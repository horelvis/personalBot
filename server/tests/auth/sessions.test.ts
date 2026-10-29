import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { SESSION_COOKIE, createSessionStore, sessionIdentify } from "../../src/auth/sessions.ts";
import { authRoutes } from "../../src/auth/routes.ts";
import type { Database } from "../../src/db/index.ts";
import { sessions } from "../../src/db/schema.ts";
import { createTestDatabase } from "../helpers/database.ts";
import { createUser } from "../helpers/users.ts";

let db: Database;
let ana: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  db = await createTestDatabase();
  ana = await createUser(db, "ana@example.com");
});

function appWith(store: ReturnType<typeof createSessionStore>) {
  return createApp({ db, identify: sessionIdentify(store), auth: authRoutes({ sessions: store, secureCookies: false }) });
}

const withCookie = (token: string) => ({ headers: { cookie: `${SESSION_COOKIE}=${token}` } });

describe("sessions", () => {
  it("identifies the person behind a valid session cookie", async () => {
    const store = createSessionStore(db);
    const token = await store.create(ana.id);
    const response = await appWith(store).request("/api/me", withCookie(token));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: ana.id, email: "ana@example.com", role: "member" });
  });

  it("answers 401 without a cookie, with an unknown token and with an expired session", async () => {
    let now = new Date("2026-10-01T00:00:00Z");
    const store = createSessionStore(db, { now: () => now, ttlMs: 60_000 });
    const token = await store.create(ana.id);
    const app = appWith(store);

    expect((await app.request("/api/me")).status).toBe(401);
    expect((await app.request("/api/me", withCookie("not-a-session"))).status).toBe(401);
    now = new Date("2026-10-01T00:02:00Z");
    expect((await app.request("/api/me", withCookie(token))).status).toBe(401);
  });

  it("stores only a hash of the token, never the token itself", async () => {
    const token = await createSessionStore(db).create(ana.id);
    const rows = await db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("signs out: the session is revoked and the cookie cleared", async () => {
    const store = createSessionStore(db);
    const token = await store.create(ana.id);
    const app = appWith(store);

    const response = await app.request("/auth/logout", { method: "POST", ...withCookie(token) });
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toMatch(new RegExp(`${SESSION_COOKIE}=;.*Max-Age=0`));
    expect((await app.request("/api/me", withCookie(token))).status).toBe(401);
  });

  it("deletes a person's expired sessions when they open a new one", async () => {
    let now = new Date("2026-10-01T00:00:00Z");
    const store = createSessionStore(db, { now: () => now, ttlMs: 60_000 });
    await store.create(ana.id);
    now = new Date("2026-10-01T00:02:00Z");
    await store.create(ana.id);
    expect(await db.select().from(sessions)).toHaveLength(1);
  });
});

