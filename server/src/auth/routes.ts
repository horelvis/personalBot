import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { SESSION_COOKIE, type SessionStore } from "./sessions.ts";

export interface AuthRouteOptions {
  sessions: SessionStore;
  /** Secure cookies need HTTPS; off only for local development over http. */
  secureCookies: boolean;
}

export function authRoutes({ sessions, secureCookies }: AuthRouteOptions) {
  const app = new Hono();

  app.post("/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await sessions.revoke(token);
    deleteCookie(c, SESSION_COOKIE, { path: "/", secure: secureCookies, httpOnly: true, sameSite: "Lax" });
    return c.body(null, 204);
  });

  return app;
}
