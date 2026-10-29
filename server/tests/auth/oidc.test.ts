import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
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

function appWith({ allowedDomains = ["example.com"] as string[] | "*", adminEmails = [] as string[], trustUnverifiedEmail = false, fetch = idp.fetch } = {}) {
  const store = createSessionStore(db);
  const oidc = createOpenIdProvider(
    { issuer: ISSUER, clientId: CLIENT_ID, redirectUri: "http://localhost:3001/auth/callback" },
    { fetch },
  );
  const access = { allowedDomains, adminEmails, trustUnverifiedEmail };
  const auth = authRoutes({ sessions: store, secureCookies: false, oidc, db, access, afterSignIn: "/" });
  return createApp({ db, identify: sessionIdentify(store, { adminEmails }), auth });
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

  it("signs a new person in as a member and opens a session", async () => {
    const app = appWith();
    const callback = await signIn(app, { sub: "u-1", email: "ana@example.com", email_verified: true, name: "Ana" });

    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("/");
    expect(callback.headers.getSetCookie().join()).toContain(`${SESSION_COOKIE}=`);
    const response = await me(app, callback);
    expect(await response.json()).toMatchObject({ email: "ana@example.com", name: "Ana", role: "member" });
  });

  it("makes people listed in ADMIN_EMAILS admins", async () => {
    const app = appWith({ adminEmails: ["boss@example.com"] });
    const callback = await signIn(app, { sub: "u-2", email: "Boss@Example.com" });
    expect(await (await me(app, callback)).json()).toMatchObject({ role: "admin" });
  });

  it("keeps the same person when their email changes at the provider", async () => {
    const app = appWith();
    const first = await (await me(app, await signIn(app, { sub: "u-1", email: "ana@example.com" }))).json();
    const second = await (await me(app, await signIn(app, { sub: "u-1", email: "ana.garcia@example.com" }))).json();
    expect(second).toMatchObject({ id: first.id, email: "ana.garcia@example.com" });
  });

  it("refuses accounts outside OIDC_ALLOWED_DOMAINS and creates nobody", async () => {
    const callback = await signIn(appWith(), { sub: "u-3", email: "eve@gmail.com" });
    expect(callback.status).toBe(403);
    expect(await callback.text()).toContain("not allowed to sign in");
    expect(await db.select().from(users)).toEqual([]);
    expect(await db.select().from(sessions)).toEqual([]);
  });

  it("admits any domain with '*'", async () => {
    const callback = await signIn(appWith({ allowedDomains: "*" }), { sub: "u-3", email: "eve@gmail.com" });
    expect(callback.status).toBe(302);
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

  it("does not take over an existing account that already has another identity", async () => {
    const app = appWith();
    await signIn(app, { sub: "u-1", email: "ana@example.com" });
    const callback = await signIn(app, { sub: "u-9", email: "ana@example.com" });
    expect(callback.status).toBe(403);
    expect(await db.select().from(users).where(eq(users.email, "ana@example.com"))).toHaveLength(1);
  });

  it("answers 502 when the provider cannot be reached, and works once it is back", async () => {
    let down = true;
    const store = createSessionStore(db);
    const oidc = createOpenIdProvider(
      { issuer: ISSUER, clientId: CLIENT_ID, redirectUri: "http://localhost:3001/auth/callback" },
      { fetch: async (url, options) => (down ? Promise.reject(new Error("ECONNREFUSED")) : idp.fetch(url, options)) },
    );
    const app = createApp({ db, identify: sessionIdentify(store), auth: authRoutes({ sessions: store, secureCookies: false, oidc, db, access: { allowedDomains: "*", adminEmails: [], trustUnverifiedEmail: false } }) });

    const failed = await app.request("/auth/login");
    expect(failed.status).toBe(502);
    expect(await failed.text()).toContain("provider");
    down = false;
    expect((await app.request("/auth/login")).status).toBe(302);
  });

  it("refuses, without an error page, an email change that collides with another account", async () => {
    const app = appWith();
    await signIn(app, { sub: "u-1", email: "ana@example.com" });
    await signIn(app, { sub: "u-2", email: "luis@example.com" });
    const callback = await signIn(app, { sub: "u-2", email: "ana@example.com" });
    expect(callback.status).toBe(403);
    expect((await db.select().from(users).where(eq(users.oidcSubject, "u-2")))[0]?.email).toBe("luis@example.com");
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

  it("admits an ADMIN_EMAILS address outside the allowed domains, and demotes it once removed", async () => {
    const asAdmin = appWith({ adminEmails: ["boss@partner.org"] });
    expect(await (await me(asAdmin, await signIn(asAdmin, { sub: "u-5", email: "boss@partner.org" }))).json()).toMatchObject({ role: "admin" });

    const removed = appWith({ allowedDomains: ["partner.org"] });
    expect(await (await me(removed, await signIn(removed, { sub: "u-5", email: "boss@partner.org" }))).json()).toMatchObject({ role: "member" });
  });

  it("signs the same new person in from two tabs at once without an error", async () => {
    const app = appWith();
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
    const app = createApp({ db, identify: sessionIdentify(store), auth: authRoutes({ sessions: store, secureCookies: true, oidc, db, access: { allowedDomains: "*", adminEmails: [], trustUnverifiedEmail: false } }) });
    const login = await app.request("/auth/login");
    expect(login.headers.getSetCookie().join()).toMatch(/Path=\/bot\/auth;.*Secure/);
  });

  it("refuses an email without email_verified unless OIDC_TRUST_UNVERIFIED_EMAIL is on", async () => {
    const claims = { sub: "u-8", email: "ana@example.com", email_verified: undefined };
    expect((await signIn(appWith(), claims)).status).toBe(403);
    expect((await signIn(appWith({ trustUnverifiedEmail: true }), claims)).status).toBe(302);
  });

  it("drops admin rights from open sessions as soon as the email leaves ADMIN_EMAILS", async () => {
    const before = appWith({ adminEmails: ["boss@example.com"] });
    const callback = await signIn(before, { sub: "u-2", email: "boss@example.com" });
    const after = appWith({ adminEmails: [] });
    expect(await (await me(after, callback)).json()).toMatchObject({ role: "member" });
    const register = await after.request("/api/bots", {
      method: "POST",
      headers: { cookie: cookiesFrom(callback), "content-type": "application/json" },
      body: JSON.stringify({ id: "x", name: "X", url: "https://agents.example.com/x" }),
    });
    expect(register.status).toBe(403);
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
});

