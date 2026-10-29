import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/app.ts";
import { createAssistant } from "../../src/assistant/agent.ts";
import { memoryTools } from "../../src/assistant/memory-tools.ts";
import { type AssistantTool, defineTool } from "../../src/assistant/tools.ts";
import { createBotStore } from "../../src/bots/store.ts";
import type { Database } from "../../src/db/index.ts";
import { createMemoryStore } from "../../src/memory/store.ts";
import { createToolGateway } from "../../src/tool-gateway/gateway.ts";
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

async function converse(turns: Turn[], said: string, tools?: AssistantTool[], authorize?: () => Promise<{ allowed: boolean }>) {
  const anthropic = createFakeAnthropic(turns);
  const memories = createMemoryStore(db);
  const gateway = createToolGateway(db);
  const app = createApp({
    db,
    identify: async () => ana,
    builtinAgents: {
      assistant: ({ user }) =>
        createAssistant({
          client: anthropic.client,
          model: "claude-opus-5-5",
          tools: tools ?? memoryTools(memories, user.id),
          authorize: authorize ?? ((call) => gateway.authorize({ ...call, userId: user.id })),
        }),
    },
  });
  const created = await app.request("/api/threads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ botId: "assistant" }),
  });
  const thread = (await created.json()) as { id: string };
  const response = await app.request(`/api/threads/${thread.id}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: { id: "u1", content: said } }),
  });
  return { stream: await response.text(), threadId: thread.id, requests: anthropic.requests, memories, gateway };
}

describe("tool gateway", () => {
  it("blocks a tool denied by a rule and leaves an audit row", async () => {
    await createToolGateway(db).addRule({ tool: "remember", effect: "deny" });
    const { stream, threadId, requests, memories, gateway } = await converse(
      [{ toolUse: { id: "toolu_1", name: "remember", input: { fact: "Prefiere té" } } }, { text: "No puedo guardarlo." }],
      "Recuerda que prefiero té",
    );

    expect(await memories.list(ana.id)).toEqual([]);
    const followUp = requests[1]?.body.messages as { content: unknown }[];
    expect(followUp.at(-1)?.content).toEqual([
      { type: "tool_result", tool_use_id: "toolu_1", content: "remember is blocked by policy.", is_error: true },
    ]);
    expect(stream).toContain('"type":"RUN_FINISHED"');
    expect(await gateway.audit(ana.id)).toEqual([
      expect.objectContaining({ userId: ana.id, threadId, tool: "remember", input: { fact: "Prefiere té" }, decision: "deny" }),
    ]);
  });

  it("writes the audit row before an allowed tool acts", async () => {
    let auditedBeforeRun: unknown[] = [];
    const gateway = createToolGateway(db);
    const probe = defineTool({
      name: "probe",
      description: "Test tool.",
      input: z.object({}),
      async run() {
        auditedBeforeRun = await gateway.audit(ana.id);
        return "ok";
      },
    });
    const { requests } = await converse([{ toolUse: { id: "toolu_1", name: "probe", input: {} } }, { text: "Hecho." }], "Prueba", [probe]);

    expect(auditedBeforeRun).toEqual([expect.objectContaining({ tool: "probe", decision: "allow" })]);
    const followUp = requests[1]?.body.messages as { content: unknown }[];
    expect(followUp.at(-1)?.content).toEqual([{ type: "tool_result", tool_use_id: "toolu_1", content: "ok" }]);
  });

  it("applies a '*' deny rule to every tool, and deny wins over allow", async () => {
    const rules = createToolGateway(db);
    await rules.addRule({ tool: "*", effect: "deny" });
    await rules.addRule({ tool: "recall", effect: "allow" });
    const { gateway, requests } = await converse(
      [{ toolUse: { id: "toolu_1", name: "recall", input: { query: "té" } } }, { text: "Nada." }],
      "¿Qué bebo?",
    );

    const followUp = requests[1]?.body.messages as { content: unknown }[];
    expect(followUp.at(-1)?.content).toEqual([
      { type: "tool_result", tool_use_id: "toolu_1", content: "recall is blocked by policy.", is_error: true },
    ]);
    expect(await gateway.audit(ana.id)).toEqual([expect.objectContaining({ tool: "recall", decision: "deny" })]);
  });

  it("audits calls to unknown tools too", async () => {
    const { gateway, requests } = await converse([{ toolUse: { id: "toolu_1", name: "nope", input: {} } }, { text: "Vaya." }], "Hola");

    expect(await gateway.audit(ana.id)).toEqual([expect.objectContaining({ tool: "nope", decision: "allow" })]);
    const followUp = requests[1]?.body.messages as { content: { is_error?: boolean }[] }[];
    expect(followUp.at(-1)?.content[0]?.is_error).toBe(true);
  });

  it("fails closed: when the gateway cannot decide, the tool does not run and the run errors", async () => {
    let ran = false;
    const probe = defineTool({
      name: "probe",
      description: "Test tool.",
      input: z.object({}),
      async run() {
        ran = true;
        return "ok";
      },
    });
    const { stream } = await converse([{ toolUse: { id: "toolu_1", name: "probe", input: {} } }], "Prueba", [probe], async () => {
      throw new Error("audit unavailable");
    });

    expect(ran).toBe(false);
    expect(stream).toContain('"type":"RUN_ERROR"');
    expect(stream).toContain("audit unavailable");
  });
});
