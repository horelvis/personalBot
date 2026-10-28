import { EventType, type Message, type RunAgentInput } from "@ag-ui/core";
import { EventEncoder } from "@ag-ui/encoder";
import { Hono } from "hono";

/** A minimal AG-UI bot over HTTP that echoes the last user message, for driving the real HttpAgent. */
export function createFakeBot({ fail = false } = {}) {
  const received: RunAgentInput[] = [];
  const app = new Hono();
  app.post("/agent", async (c) => {
    const input = (await c.req.json()) as RunAgentInput;
    received.push(input);
    if (fail) return c.text("model exploded", 500);
    const lastUser = [...input.messages].reverse().find((message: Message) => message.role === "user");
    const text = `Eco: ${typeof lastUser?.content === "string" ? lastUser.content : ""}`;
    const encoder = new EventEncoder();
    const messageId = `reply-${received.length}`;
    const events = [
      { type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId },
      { type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" },
      { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: text },
      { type: EventType.TEXT_MESSAGE_END, messageId },
      { type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId },
    ];
    return new Response(events.map((event) => encoder.encodeSSE(event)).join(""), {
      headers: { "content-type": "text/event-stream" },
    });
  });
  return {
    received,
    fetch: (url: string, init: RequestInit) => Promise.resolve(app.request(url, init)),
  };
}
