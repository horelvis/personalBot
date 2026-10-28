import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { createAssistant } from "../../src/assistant/agent.ts";
import { memoryTools } from "../../src/assistant/memory-tools.ts";
import { createBotStore } from "../../src/bots/store.ts";
import type { Database } from "../../src/db/index.ts";
import { createMemoryStore } from "../../src/memory/store.ts";
import { createTestDatabase } from "../helpers/database.ts";
import { type Turn, createFakeAnthropic } from "../helpers/fake-anthropic.ts";
import { createUser } from "../helpers/users.ts";

let db: Database;
let ana: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  db = await createTestDatabase();
  ana = await createUser(db, "ana@example.com");
  await createBotStore(db).ensure({ id: "assistant", name: "Asistente", url: "builtin:assistant" });
});

async function converse(turns: Turn[], said: string[]) {
  const anthropic = createFakeAnthropic(turns);
  const memories = createMemoryStore(db);
  const app = createApp({
    db,
    identify: async () => ana,
    builtinAgents: {
      assistant: ({ user }) =>
        createAssistant({
          client: anthropic.client,
          model: "claude-opus-5-5",
          tools: memoryTools(memories, user.id),
          context: async () => memoryContext(await memories.list(user.id)),
        }),
    },
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
  return { streams, history, requests: anthropic.requests, memories };
}

function memoryContext(facts: { content: string }[]) {
  return facts.length ? `Facts about the person:\n${facts.map((fact) => `- ${fact.content}`).join("\n")}` : "";
}

describe("assistant memory tools", () => {
  it("remembers a fact through the remember tool and finishes the turn with Claude's reply", async () => {
    const { streams, history, requests, memories } = await converse(
      [
        { text: "Lo apunto.", toolUse: { id: "toolu_1", name: "remember", input: { fact: "Prefiere respuestas cortas" } } },
        { text: "Anotado." },
      ],
      ["Recuerda que prefiero respuestas cortas"],
    );

    expect((await memories.list(ana.id)).map((memory) => memory.content)).toEqual(["Prefiere respuestas cortas"]);
    expect(streams[0]).toContain('"type":"TOOL_CALL_START"');
    expect(streams[0]).toContain('"toolCallName":"remember"');
    expect(streams[0]).toContain('"type":"TOOL_CALL_RESULT"');
    expect(streams[0]).toContain('"type":"RUN_FINISHED"');

    const followUp = requests[1]?.body.messages as { role: string; content: unknown }[];
    expect(followUp.at(-2)).toMatchObject({
      role: "assistant",
      content: [{ type: "text", text: "Lo apunto." }, { type: "tool_use", id: "toolu_1", name: "remember" }],
    });
    expect(followUp.at(-1)).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "Remembered." }],
    });
    expect(history.map((message: { role: string }) => message.role)).toEqual(["user", "assistant", "tool", "assistant"]);
  });

  it("replays stored tool turns to Claude on the next run", async () => {
    const { requests } = await converse(
      [
        { toolUse: { id: "toolu_1", name: "remember", input: { fact: "Su gata se llama Mora" } } },
        { text: "Anotado." },
        { text: "Mora." },
      ],
      ["Mi gata se llama Mora", "¿Cómo se llama mi gata?"],
    );

    expect(requests[2]?.body.messages).toEqual([
      { role: "user", content: "Mi gata se llama Mora" },
      { role: "assistant", content: [{ type: "tool_use", id: "toolu_1", name: "remember", input: { fact: "Su gata se llama Mora" } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "Remembered." }] },
      { role: "assistant", content: "Anotado." },
      { role: "user", content: "¿Cómo se llama mi gata?" },
    ]);
  });

  it("recalls matching facts", async () => {
    await createMemoryStore(db).add(ana.id, "Su gata se llama Mora");
    const { requests } = await converse(
      [{ toolUse: { id: "toolu_1", name: "recall", input: { query: "gata" } } }, { text: "Mora." }],
      ["¿Cómo se llama mi gata?"],
    );
    const followUp = requests[1]?.body.messages as { content: unknown }[];
    expect(followUp.at(-1)?.content).toEqual([{ type: "tool_result", tool_use_id: "toolu_1", content: "- Su gata se llama Mora" }]);
  });

  it("answers invalid tool input with an error result instead of running the tool", async () => {
    const { requests, memories } = await converse(
      [{ toolUse: { id: "toolu_1", name: "remember", input: { wrong: 1 } } }, { text: "Perdón." }],
      ["Recuerda algo"],
    );
    expect(await memories.list(ana.id)).toEqual([]);
    const followUp = requests[1]?.body.messages as { content: { is_error?: boolean }[] }[];
    expect(followUp.at(-1)?.content[0]?.is_error).toBe(true);
  });

  it("puts the person's facts in the system prompt and keeps it fixed for the whole run", async () => {
    await createMemoryStore(db).add(ana.id, "Trabaja en el equipo de pagos");
    const { requests } = await converse(
      [{ toolUse: { id: "toolu_1", name: "remember", input: { fact: "Nuevo hecho" } } }, { text: "Hecho." }],
      ["Hola"],
    );
    expect(JSON.stringify(requests[0]?.body.system)).toContain("Trabaja en el equipo de pagos");
    expect(requests[1]?.body.system).toEqual(requests[0]?.body.system);
    expect(requests[0]?.body.tools).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "remember", eager_input_streaming: true })]),
    );
  });
});
