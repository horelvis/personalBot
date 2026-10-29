import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { createBotStore } from "../../src/bots/store.ts";
import type { Database } from "../../src/db/index.ts";
import { createThreadStore } from "../../src/threads/store.ts";
import { createTestDatabase } from "../helpers/database.ts";
import { createFakeBot } from "../helpers/fake-bot.ts";
import { createUser } from "../helpers/users.ts";

let db: Database;
let ana: Awaited<ReturnType<typeof createUser>>;
let luis: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  db = await createTestDatabase();
  ana = await createUser(db, "ana@example.com");
  luis = await createUser(db, "luis@example.com");
  await createBotStore(db).add({ id: "echo", name: "Echo", url: "http://fake-bot/agent" });
});

function appFor(user: typeof ana | null, bot = createFakeBot()) {
  return { bot, app: createApp({ db, identify: async () => user, agentFetch: bot.fetch }) };
}

async function newThread(app: ReturnType<typeof createApp>) {
  const response = await app.request("/api/threads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ botId: "echo", title: "Prueba" }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string };
}

function run(app: ReturnType<typeof createApp>, threadId: string, id: string, content: string) {
  return app.request(`/api/threads/${threadId}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: { id, content } }),
  });
}

describe("threads API", () => {
  it("rejects requests without an identified person", async () => {
    const { app } = appFor(null);
    expect((await app.request("/api/threads")).status).toBe(401);
  });

  it("creates and lists only the caller's threads", async () => {
    const { app } = appFor(ana);
    const thread = await newThread(app);
    const mine = await (await app.request("/api/threads")).json();
    expect(mine.map((t: { id: string }) => t.id)).toEqual([thread.id]);
    const theirs = await (await appFor(luis).app.request("/api/threads")).json();
    expect(theirs).toEqual([]);
  });

  it("refuses a thread with a bot that is not registered", async () => {
    const { app } = appFor(ana);
    const response = await app.request("/api/threads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ botId: "nope" }),
    });
    expect(response.status).toBe(400);
  });
});

describe("POST /api/threads/:id/runs", () => {
  it("relays the turn to the AG-UI bot, streams its events and stores both messages", async () => {
    const { app, bot } = appFor(ana);
    const thread = await newThread(app);

    const response = await run(app, thread.id, "u1", "Hola");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const body = await response.text();
    expect(body).toContain('"type":"TEXT_MESSAGE_CONTENT"');
    expect(body).toContain("Eco: Hola");
    expect(body).toContain('"type":"RUN_FINISHED"');

    expect(bot.received[0]?.messages).toEqual([{ id: "u1", role: "user", content: "Hola" }]);
    const history = await (await app.request(`/api/threads/${thread.id}/messages`)).json();
    expect(history).toEqual([
      { id: "u1", role: "user", content: "Hola" },
      { id: "reply-1", role: "assistant", content: "Eco: Hola" },
    ]);
  });

  it("sends the bot the history from our database on the next turn", async () => {
    const { app, bot } = appFor(ana);
    const thread = await newThread(app);
    await (await run(app, thread.id, "u1", "Hola")).text();
    await (await run(app, thread.id, "u2", "Otra")).text();

    expect(bot.received[1]?.messages.map((message) => message.id)).toEqual(["u1", "reply-1", "u2"]);
    expect(bot.received[1]?.threadId).toBe(thread.id);
  });

  it("answers 404 for somebody else's thread", async () => {
    const thread = await newThread(appFor(ana).app);
    expect((await run(appFor(luis).app, thread.id, "u1", "Hola")).status).toBe(404);
  });

  it("answers 409 while another run holds the thread", async () => {
    const { app } = appFor(ana);
    const thread = await newThread(app);
    await createThreadStore(db).lock(thread.id, "other-run");
    expect((await run(app, thread.id, "u1", "Hola")).status).toBe(409);
  });

  it("reports a failing bot as RUN_ERROR, keeps the user's message and frees the thread", async () => {
    const { app } = appFor(ana, createFakeBot({ fail: true }));
    const thread = await newThread(app);

    const body = await (await run(app, thread.id, "u1", "Hola")).text();
    expect(body).toContain('"type":"RUN_ERROR"');

    const history = await (await app.request(`/api/threads/${thread.id}/messages`)).json();
    expect(history).toEqual([{ id: "u1", role: "user", content: "Hola" }]);
    const release = await createThreadStore(db).lock(thread.id, "next-run");
    await release();
  });
});
