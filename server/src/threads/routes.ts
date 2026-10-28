import type { HttpAgentFetchFn } from "@ag-ui/client";
import { Hono } from "hono";
import { z } from "zod";
import type { User } from "../auth/identify.ts";
import { createBotStore } from "../bots/store.ts";
import type { Database } from "../db/index.ts";
import { relayTurn } from "../runs/relay.ts";
import { ThreadBusyError, createThreadStore } from "./store.ts";

const newThreadBody = z.object({ botId: z.string().min(1), title: z.string().optional() });
const runBody = z.object({ message: z.object({ id: z.string().min(1), content: z.string().min(1) }) });

export function threadRoutes(db: Database, { agentFetch }: { agentFetch?: HttpAgentFetchFn }) {
  const threads = createThreadStore(db);
  const bots = createBotStore(db);
  const app = new Hono<{ Variables: { user: User } }>();

  app.get("/", async (c) => c.json(await threads.list(c.var.user.id)));

  app.post("/", async (c) => {
    const body = newThreadBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "botId is required" }, 400);
    if (!(await bots.get(body.data.botId))) return c.json({ error: `Unknown bot ${body.data.botId}` }, 400);
    const thread = await threads.create({ ownerId: c.var.user.id, ...body.data });
    return c.json(thread, 201);
  });

  app.get("/:id/messages", async (c) => {
    const thread = await threads.get(c.var.user.id, c.req.param("id"));
    if (!thread) return c.json({ error: "Not found" }, 404);
    return c.json(await threads.history(thread.id));
  });

  app.post("/:id/runs", async (c) => {
    const body = runBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "message.id and message.content are required" }, 400);
    const thread = await threads.get(c.var.user.id, c.req.param("id"));
    if (!thread) return c.json({ error: "Not found" }, 404);
    const bot = await bots.get(thread.botId);
    if (!bot) return c.json({ error: `Bot ${thread.botId} is no longer registered` }, 409);

    const runId = crypto.randomUUID();
    let release: () => Promise<void>;
    try {
      release = await threads.lock(thread.id, runId);
    } catch (error) {
      if (error instanceof ThreadBusyError) return c.json({ error: error.message }, 409);
      throw error;
    }

    try {
      await threads.append(thread.id, [{ id: body.data.message.id, role: "user", content: body.data.message.content }]);
      const stream = await relayTurn({ threads, bot, threadId: thread.id, runId, release, agentFetch });
      return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
    } catch (error) {
      await release();
      throw error;
    }
  });

  return app;
}
