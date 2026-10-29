import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { type AssistantOptions, createAssistant } from "../../src/assistant/agent.ts";
import { createBotStore } from "../../src/bots/store.ts";
import type { Database } from "../../src/db/index.ts";
import { createTestDatabase } from "../helpers/database.ts";
import { createFakeAnthropic } from "../helpers/fake-anthropic.ts";
import { createUser } from "../helpers/users.ts";

let db: Database;
let ana: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  db = await createTestDatabase();
  ana = await createUser(db, "ana@example.com");
  await createBotStore(db).ensure({ id: "assistant", name: "Asistente", url: "builtin:assistant" });
});

async function converse(turns: Parameters<typeof createFakeAnthropic>[0], said: string[], options: Partial<AssistantOptions> = {}) {
  const anthropic = createFakeAnthropic(turns);
  const app = createApp({
    db,
    identify: async () => ana,
    builtinAgents: { assistant: () => createAssistant({ client: anthropic.client, model: "claude-opus-5-5", ...options }) },
  });
  const created = await app.request("/api/threads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ botId: "assistant" }),
  });
  const thread = (await created.json()) as { id: string };
  const streams: string[] = [];
  for (const [index, content] of said.entries()) {
    const response = await app.request(`/api/threads/${thread.id}/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: { id: `u${index + 1}`, content } }),
    });
    streams.push(await response.text());
  }
  const history = await (await app.request(`/api/threads/${thread.id}/messages`)).json();
  return { streams, history, requests: anthropic.requests };
}

describe("built-in assistant", () => {
  it("streams Claude's reply as AG-UI text events and stores it in the thread", async () => {
    const { streams, history } = await converse([{ text: "Hola, Ana." }], ["Hola"]);

    expect(streams[0]).toContain('"type":"TEXT_MESSAGE_START"');
    expect(streams[0]).toContain('"delta":"Hola,"');
    expect(streams[0]).toContain('"delta":" Ana."');
    expect(streams[0]).toContain('"type":"RUN_FINISHED"');
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({ role: "assistant", content: "Hola, Ana." });
  });

  it("leaves out Anthropic's server-side fallbacks for a gateway such as OpenRouter or DeepSeek", async () => {
    const { requests, streams, history } = await converse([{ text: "Hola." }], ["Hola"], { serverSideFallbacks: false });

    expect(requests[0]?.body).not.toHaveProperty("fallbacks");
    expect(requests[0]?.headers.get("anthropic-beta") ?? "").not.toContain("server-side-fallback");
    expect(streams[0]).toContain('"type":"RUN_FINISHED"');
    expect(history[1]).toMatchObject({ role: "assistant", content: "Hola." });
  });

  it("asks Claude with the configured model, refusal fallbacks and the whole thread", async () => {
    const { requests } = await converse([{ text: "Hola." }, { text: "Claro." }], ["Hola", "¿Me ayudas?"]);

    const second = requests[1];
    expect(second?.body.model).toBe("claude-opus-5-5");
    expect(second?.body.fallbacks).toBe("default");
    expect(second?.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(second?.body.output_config).toEqual({ effort: "medium" });
    expect(second?.body.stream).toBe(true);
    expect(second?.body.messages).toEqual([
      { role: "user", content: "Hola" },
      { role: "assistant", content: "Hola." },
      { role: "user", content: "¿Me ayudas?" },
    ]);
  });

  it("reports a refusal as RUN_ERROR instead of an empty answer", async () => {
    const { streams } = await converse([{ text: "", stopReason: "refusal" }], ["algo"]);
    expect(streams[0]).toContain('"type":"RUN_ERROR"');
    expect(streams[0]).toContain("declined");
  });
});

describe("bot store ensure", () => {
  it("is idempotent and updates the stored URL", async () => {
    const bots = createBotStore(db);
    await bots.ensure({ id: "assistant", name: "Asistente", url: "builtin:other" });
    expect((await bots.get("assistant"))?.url).toBe("builtin:other");
    expect((await bots.list()).filter((bot) => bot.id === "assistant")).toHaveLength(1);
  });
});
