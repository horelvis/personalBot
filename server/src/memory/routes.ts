import { Hono } from "hono";
import { z } from "zod";
import type { User } from "../auth/identify.ts";
import type { Database } from "../db/index.ts";
import { createMemoryStore } from "./store.ts";

const newMemoryBody = z.object({ content: z.string().trim().min(1).max(2000) });

export function memoryRoutes(db: Database) {
  const memories = createMemoryStore(db);
  const app = new Hono<{ Variables: { user: User } }>();

  app.get("/", async (c) => c.json(await memories.list(c.var.user.id)));

  app.post("/", async (c) => {
    const body = newMemoryBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "content is required" }, 400);
    return c.json(await memories.add(c.var.user.id, body.data.content), 201);
  });

  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!z.uuid().safeParse(id).success || !(await memories.remove(c.var.user.id, id))) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.body(null, 204);
  });

  return app;
}
