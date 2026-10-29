import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { createOpenIdProvider } from "../../src/auth/oidc-client.ts";
import { authRoutes } from "../../src/auth/routes.ts";
import { SESSION_COOKIE, createSessionStore, sessionIdentify } from "../../src/auth/sessions.ts";
import type { Database } from "../../src/db/index.ts";
import { sessions, users } from "../../src/db/schema.ts";
import { CLIENT_ID, ISSUER, type IdentityClaims, createFakeIdp } from "../helpers/fake-idp.ts";
import { createTestDatabase } from "../helpers/database.ts";
import { createUser } from "../helpers/users.ts";

let db: Database;
let idp: Awaited<ReturnType<typeof createFakeIdp>>;

beforeEach(async () => {
  db = await createTestDatabase();
  idp = await createFakeIdp();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function appWith({ ownerEmail = "ana@example.com", trustUnverifiedEmail = false, fetch = idp.fetch } = {}) {
  const store = createSessionStore(db);
  const oidc = createOpenIdProvider(
    { issuer: ISSUER, clientId: CLIENT_ID, redirectUri: "http://localhost:3001/auth/callback" },
    { fetch },
  );
  const access = { ownerEmail, trustUnverifiedEmail };
  const auth = authRoutes({ sessions: store, secureCookies: false, oidc, db, access, afterSignIn: "/" });
  return createApp({ db, identify: sessionIdentify(store, { ownerEmail }), auth });
}

function cookiesFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

/** Browser round trip: /auth/login → IdP → /auth/callback. */
async function signIn(app: ReturnType<typeof appWith>, claims: IdentityClaims, tamper?: (callback: URL) => void) {
  const login = await app.request("/auth/login");
  const authorizationUrl = new URL(login.headers.get("location") ?? "");
  const callback = new URL("http://localhost:3001/auth/callback");
  callback.searchParams.set("code", idp.issueCode(authorizationUrl, { email_verified: true, ...claims }));
  callback.searchParams.set("state", authorizationUrl.searchParams.get("state") ?? "");
  tamper?.(callback);
  return app.request(callback.pathname + callback.search, { headers: { cookie: cookiesFrom(login) } });
}

async function me(app: ReturnType<typeof appWith>, callback: Response) {
  return app.request("/api/me", { headers: { cookie: cookiesFrom(callback) } });
}

describe("OIDC sign-in", () => {
  it("sends the browser to the provider with PKCE, state and nonce", async () => {
    const login = await appWith().request("/auth/login");
    expect(login.status).toBe(302);
    const url = new URL(login.headers.get("location") ?? "");
    expect(url.origin + url.pathname).toBe(`${ISSUER}/authorize`);
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3001/auth/callback");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("nonce")).toBeTruthy();
    expect(login.headers.getSetCookie().join()).toMatch(/HttpOnly/);
  });

  it("signs the owner in and opens a session", async () => {
    const app = appWith();
    const callback = await signIn(app, { sub: "u-1", email: "ana@example.com", email_verified: true, name: "Ana" });

    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("/");
    expect(callback.headers.getSetCookie().join()).toContain(`${SESSION_COOKIE}=`);
    const response = await me(app, callback);
    expect(await response.json()).toEqual({ id: expect.any(String), email: "ana@example.com", name: "Ana" });
  });

  it("matches OWNER_EMAIL whatever the case the provider sends", async () => {
    const app = appWith();
    const callback = await signIn(app, { sub: "u-1", email: "Ana@Example.COM" });
    expect(callback.status).toBe(302);
    expect((await me(app, callback)).status).toBe(200);
  });

  it("keeps the same person when their email changes at the provider and OWNER_EMAIL follows it", async () => {
    const before = appWith();
    const first = await (await me(before, await signIn(before, { sub: "u-1", email: "ana@example.com" }))).json();
    const after = appWith({ ownerEmail: "ana.garcia@example.com" });
    const second = await (await me(after, await signIn(after, { sub: "u-1", email: "ana.garcia@example.com" }))).json();
    expect(second).toMatchObject({ id: first.id, email: "ana.garcia@example.com" });
  });

  it.each([
    ["another person of the same domain", "luis@example.com"],
    ["someone from another domain", "eve@gmail.com"],
  ])("refuses %s with 403 and creates no user and no session", async (_, email) => {
    const callback = await signIn(appWith(), { sub: "u-3", email });
    expect(callback.status).toBe(403);
    expect(await callback.text()).toContain("not allowed to sign in");
    expect(await db.select().from(users)).toEqual([]);
    expect(await db.select().from(sessions)).toEqual([]);
  });

  it("refuses an email the provider says is not verified", async () => {
    const callback = await signIn(appWith(), { sub: "u-4", email: "ana@example.com", email_verified: false });
    expect(callback.status).toBe(403);
  });

  it("refuses a callback whose state does not match the login, and opens no session", async () => {
    const callback = await signIn(appWith(), { sub: "u-1", email: "ana@example.com" }, (url) => url.searchParams.set("state", "forged"));
    expect(callback.status).toBe(400);
    expect(await db.select().from(sessions)).toEqual([]);
  });

  it("refuses a callback without the login cookie", async () => {
    const response = await appWith().request("/auth/callback?code=x&state=y");
    expect(response.status).toBe(400);
  });

  it("re-links the owner's account to a new identity when the provider verifies OWNER_EMAIL, keeping the account", async () => {
    const app = appWith();
    const before = await (await me(app, await signIn(app, { sub: "u-1", email: "ana@example.com" }))).json();
    const callback = await signIn(app, { sub: "u-9", email: "ana@example.com" });
    expect(callback.status).toBe(302);
    expect((await (await me(app, callback)).json()).id).toBe(before.id);
    const accounts = await db.select().from(users).where(eq(users.email, "ana@example.com"));
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.oidcSubject).toBe("u-9");
  });

  it("keeps refusing a new identity for OWNER_EMAIL when the provider does not verify the email, and logs why", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const app = appWith({ trustUnverifiedEmail: true });
    await signIn(app, { sub: "u-1", email: "ana@example.com" });
    const callback = await signIn(app, { sub: "u-9", email: "ana@example.com", email_verified: undefined });
    expect(callback.status).toBe(403);
    expect((await db.select().from(users).where(eq(users.email, "ana@example.com")))[0]?.oidcSubject).toBe("u-1");
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/OWNER_EMAIL is linked to another identity.*not verified/));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("ana@example.com"));
  });

  it("never re-links the owner's account for an email the provider marks as not verified, even with OIDC_TRUST_UNVERIFIED_EMAIL", async () => {
    const app = appWith({ trustUnverifiedEmail: true });
    await signIn(app, { sub: "u-1", email: "ana@example.com" });
    const callback = await signIn(app, { sub: "u-9", email: "ana@example.com", email_verified: false });
    expect(callback.status).toBe(403);
    expect((await db.select().from(users).where(eq(users.email, "ana@example.com")))[0]?.oidcSubject).toBe("u-1");
  });

  it("re-links only the account of OWNER_EMAIL: a verified holder of a former owner's email is refused and changes nothing", async () => {
    const asLuis = appWith({ ownerEmail: "luis@example.com" });
    await signIn(asLuis, { sub: "u-2", email: "luis@example.com" });
    const app = appWith();
    const callback = await signIn(app, { sub: "u-9", email: "luis@example.com" });
    expect(callback.status).toBe(403);
    expect((await db.select().from(users).where(eq(users.email, "luis@example.com")))[0]?.oidcSubject).toBe("u-2");
  });

  it("answers 502 when the provider cannot be reached, and works once it is back", async () => {
    let down = true;
    const store = createSessionStore(db);
    const oidc = createOpenIdProvider(
      { issuer: ISSUER, clientId: CLIENT_ID, redirectUri: "http://localhost:3001/auth/callback" },
      { fetch: async (url, options) => (down ? Promise.reject(new Error("ECONNREFUSED")) : idp.fetch(url, options)) },
    );
    const app = createApp({ db, identify: sessionIdentify(store), auth: authRoutes({ sessions: store, secureCookies: false, oidc, db, access: { ownerEmail: "ana@example.com", trustUnverifiedEmail: false } }) });

    const failed = await app.request("/auth/login");
    expect(failed.status).toBe(502);
    expect(await failed.text()).toContain("provider");
    down = false;
    expect((await app.request("/auth/login")).status).toBe(302);
  });

  it("refuses, without an error page, an email change that collides with another account", async () => {
    const app = appWith();
    await signIn(app, { sub: "u-1", email: "ana@example.com" });
    const asLuis = appWith({ ownerEmail: "luis@example.com" });
    expect((await signIn(asLuis, { sub: "u-2", email: "luis@example.com" })).status).toBe(302);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const callback = await signIn(app, { sub: "u-2", email: "ana@example.com" });
    expect(callback.status).toBe(403);
    expect((await db.select().from(users).where(eq(users.oidcSubject, "u-2")))[0]?.email).toBe("luis@example.com");
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/already belongs to another account/));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("@example.com"));
  });

  it("refuses a code redeemed without the PKCE verifier of its login", async () => {
    const app = appWith();
    const login = await app.request("/auth/login");
    const other = await app.request("/auth/login");
    const authorizationUrl = new URL(login.headers.get("location") ?? "");
    const callback = new URL("http://localhost:3001/auth/callback");
    callback.searchParams.set("code", idp.issueCode(authorizationUrl, { sub: "u-1", email: "ana@example.com" }));
    callback.searchParams.set("state", new URL(other.headers.get("location") ?? "").searchParams.get("state") ?? "");
    const response = await app.request(callback.pathname + callback.search, { headers: { cookie: cookiesFrom(other) } });
    expect(response.status).toBe(400);
    expect(await db.select().from(sessions)).toEqual([]);
  });

  it("links an account created before sign-in, whatever the case of its stored email", async () => {
    const existing = await createUser(db, "Ana@Example.com");
    const app = appWith();
    const signedIn = await (await me(app, await signIn(app, { sub: "u-1", email: "ana@example.com" }))).json();
    expect(signedIn.id).toBe(existing.id);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("signs the same new person in from two tabs at once without an error", async () => {
    const app = appWith({ ownerEmail: "new@example.com" });
    const [first, second] = await Promise.all([
      signIn(app, { sub: "u-7", email: "new@example.com" }),
      signIn(app, { sub: "u-7", email: "new@example.com" }),
    ]);
    expect([first.status, second.status]).toEqual([302, 302]);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("scopes the login cookie to the callback path, also under a PUBLIC_URL prefix", async () => {
    const store = createSessionStore(db);
    const oidc = createOpenIdProvider({ issuer: ISSUER, clientId: CLIENT_ID, redirectUri: "https://example.com/bot/auth/callback" }, { fetch: idp.fetch });
    const app = createApp({ db, identify: sessionIdentify(store), auth: authRoutes({ sessions: store, secureCookies: true, oidc, db, access: { ownerEmail: "ana@example.com", trustUnverifiedEmail: false } }) });
    const login = await app.request("/auth/login");
    expect(login.headers.getSetCookie().join()).toMatch(/Path=\/bot\/auth;.*Secure/);
  });

  it("refuses an email without email_verified unless OIDC_TRUST_UNVERIFIED_EMAIL is on", async () => {
    const claims = { sub: "u-8", email: "ana@example.com", email_verified: undefined };
    expect((await signIn(appWith(), claims)).status).toBe(403);
    expect((await signIn(appWith({ trustUnverifiedEmail: true }), claims)).status).toBe(302);
  });

  it("ends the previous owner's open sessions as soon as OWNER_EMAIL changes", async () => {
    const before = appWith();
    const callback = await signIn(before, { sub: "u-1", email: "ana@example.com" });
    expect((await me(before, callback)).status).toBe(200);
    const after = appWith({ ownerEmail: "luis@example.com" });
    expect((await me(after, callback)).status).toBe(401);
    const register = await after.request("/api/bots", {
      method: "POST",
      headers: { cookie: cookiesFrom(callback), "content-type": "application/json" },
      body: JSON.stringify({ id: "x", name: "X", url: "https://agents.example.com/x" }),
    });
    expect(register.status).toBe(401);
    const listed = await before.request("/api/bots", { headers: { cookie: cookiesFrom(callback) } });
    expect(await listed.json()).toEqual([]);
  });

  it("answers 502, not 400, when the provider fails during the callback", async () => {
    let down = false;
    const app = appWith({ fetch: async (url, options) => (down ? Promise.reject(new TypeError("fetch failed")) : idp.fetch(url, options)) });
    const response = await signIn(app, { sub: "u-1", email: "ana@example.com" }, () => {
      down = true;
    });
    expect(response.status).toBe(502);
    expect(await db.select().from(sessions)).toEqual([]);
  });

  it.each([
    ["an HTML error page", () => new Response("<h1>503 Service Unavailable</h1>", { status: 503, headers: { "content-type": "text/html" } })],
    ["an OAuth temporarily_unavailable error", () => Response.json({ error: "temporarily_unavailable" }, { status: 503 })],
    ["an OAuth server_error", () => Response.json({ error: "server_error" }, { status: 500 })],
  ])("answers 502 when the token endpoint is down and returns %s", async (_, outage) => {
    const app = appWith();
    const response = await signIn(app, { sub: "u-1", email: "ana@example.com" }, () => idp.failTokenEndpoint(outage));
    expect(response.status).toBe(502);
  });

  it("still answers 400 when the provider rejects the code itself", async () => {
    const app = appWith();
    const response = await signIn(app, { sub: "u-1", email: "ana@example.com" }, (url) => url.searchParams.set("code", "unknown"));
    expect(response.status).toBe(400);
  });
});

