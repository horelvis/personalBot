import { createMiddleware } from "hono/factory";
import type { User } from "./identify.ts";

/** Lets the request through only when the signed-in person has role. */
export function requireRole(role: User["role"]) {
  return createMiddleware<{ Variables: { user: User } }>(async (c, next) => {
    if (c.var.user.role !== role) return c.json({ error: "Only admins can do this." }, 403);
    await next();
  });
}
