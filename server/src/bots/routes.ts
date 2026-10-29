import { Hono } from "hono";
import { z } from "zod";
import type { User } from "../auth/identify.ts";
import type { Database } from "../db/index.ts";
import { createBotStore } from "./store.ts";

const newBotBody = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "id must be lower-case letters, digits and dashes"),
  name: z.string().trim().min(1).max(100),
  // Only remote AG-UI endpoints; `builtin:` URLs are reserved for agents that run inside this server.
  url: z.url({ protocol: /^https?$/ }),
  description: z.string().trim().max(500).optional(),
});

export function botRoutes(db: Database) {
  const bots = createBotStore(db);
  const app = new Hono<{ Variables: { user: User } }>();

  // The list shows what can be talked to, not where it runs.
  app.get("/", async (c) => c.json((await bots.list()).map(({ id, name, description }) => ({ id, name, description }))));

  app.post("/", async (c) => {
    const body = newBotBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Invalid bot" }, 400);
    if (await bots.get(body.data.id)) return c.json({ error: `A bot with id ${body.data.id} already exists` }, 409);
    return c.json(await bots.add(body.data), 201);
  });

  return app;
}
