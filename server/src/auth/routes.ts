import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Database } from "../db/index.ts";
import { type AccessPolicy, signInAccount } from "./accounts.ts";
import { type OidcProvider, type PendingLogin, ProviderUnavailableError } from "./oidc.ts";
import { SESSION_COOKIE, type SessionStore } from "./sessions.ts";

const LOGIN_COOKIE = "personalbot_oidc";
const LOGIN_TTL_SECONDS = 10 * 60;

export interface AuthRouteOptions {
  sessions: SessionStore;
  /** Secure cookies need HTTPS; off only for local development over http. */
  secureCookies: boolean;
  oidc?: OidcProvider;
  db?: Database;
  access?: AccessPolicy;
  /** Where the browser lands after signing in. */
  afterSignIn?: string;
}

export function authRoutes({ sessions, secureCookies, oidc, db, access, afterSignIn = "/" }: AuthRouteOptions) {
  const app = new Hono();
  const cookie = { secure: secureCookies, httpOnly: true, sameSite: "Lax" } as const;

  if (oidc && db && access) {
    // Where the browser sees the callback, which differs from /auth when PUBLIC_URL has a path prefix.
    const loginPath = new URL(oidc.redirectUri).pathname.replace(/\/callback$/, "");
    app.get("/login", async (c) => {
      let started;
      try {
        started = await oidc.start();
      } catch (error) {
        console.error("OIDC provider unreachable:", error instanceof Error ? error.message : error);
        return c.json({ error: "The sign-in provider cannot be reached right now. Try again later." }, 502);
      }
      const { url, pending } = started;
      // Ties the callback to this browser: state, nonce and PKCE verifier never leave it except to come back.
      setCookie(c, LOGIN_COOKIE, Buffer.from(JSON.stringify(pending)).toString("base64url"), {
        ...cookie,
        path: loginPath,
        maxAge: LOGIN_TTL_SECONDS,
      });
      return c.redirect(url.href, 302);
    });

    app.get("/callback", async (c) => {
      const pending = readPending(getCookie(c, LOGIN_COOKIE));
      deleteCookie(c, LOGIN_COOKIE, { ...cookie, path: loginPath });
      if (!pending) return c.json({ error: "Sign-in expired or was started in another browser. Try again." }, 400);

      // The provider redirected to redirectUri; rebuild it so a proxy in front does not change what is checked.
      const callbackUrl = new URL(oidc.redirectUri);
      callbackUrl.search = new URL(c.req.url).search;
      let identity;
      try {
        identity = await oidc.finish(callbackUrl, pending);
      } catch (error) {
        if (error instanceof ProviderUnavailableError) {
          console.error(error.message);
          return c.json({ error: "The sign-in provider cannot be reached right now. Try again later." }, 502);
        }
        console.warn("OIDC callback rejected:", error instanceof Error ? error.message : error);
        return c.json({ error: "Sign-in failed. Try again." }, 400);
      }

      const user = await signInAccount(db, identity, access);
      if (!user) return c.json({ error: "This account is not allowed to sign in." }, 403);
      const token = await sessions.create(user.id);
      setCookie(c, SESSION_COOKIE, token, { ...cookie, path: "/", maxAge: Math.floor(sessions.ttlMs / 1000) });
      return c.redirect(afterSignIn, 302);
    });
  }

  app.post("/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await sessions.revoke(token);
    deleteCookie(c, SESSION_COOKIE, { ...cookie, path: "/" });
    return c.body(null, 204);
  });

  return app;
}

function readPending(value: string | undefined): PendingLogin | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString()) as Partial<PendingLogin>;
    const { state, nonce, codeVerifier } = parsed;
    return typeof state === "string" && typeof nonce === "string" && typeof codeVerifier === "string" ? { state, nonce, codeVerifier } : null;
  } catch {
    return null;
  }
}
