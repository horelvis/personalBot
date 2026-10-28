import Anthropic from "@anthropic-ai/sdk";

export interface CapturedRequest {
  headers: Headers;
  body: Record<string, unknown>;
}

export type Turn = {
  text?: string;
  toolUse?: { id: string; name: string; input: unknown };
  stopReason?: string;
};

/** An Anthropic client whose HTTP layer replays canned Messages API streams, one per request. */
export function createFakeAnthropic(turns: Turn[]) {
  const requests: CapturedRequest[] = [];
  const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    requests.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    const turn = turns[requests.length - 1] ?? { text: "" };
    const blocks: Record<string, unknown>[] = [];
    if (turn.text !== undefined) {
      const index = 0;
      blocks.push(
        { type: "content_block_start", index, content_block: { type: "text", text: "" } },
        ...splitInTwo(turn.text).map((text) => ({ type: "content_block_delta", index, delta: { type: "text_delta", text } })),
        { type: "content_block_stop", index },
      );
    }
    if (turn.toolUse) {
      const index = turn.text !== undefined ? 1 : 0;
      const { id, name, input } = turn.toolUse;
      blocks.push(
        { type: "content_block_start", index, content_block: { type: "tool_use", id, name, input: {} } },
        { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(input) } },
        { type: "content_block_stop", index },
      );
    }
    const stopReason = turn.stopReason ?? (turn.toolUse ? "tool_use" : "end_turn");
    const events = [
      { type: "message_start", message: { id: `msg_${requests.length}`, type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } },
      ...blocks,
      { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 5 } },
      { type: "message_stop" },
    ];
    const body = events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  };
  return { requests, client: new Anthropic({ apiKey: "test-key", fetch, maxRetries: 0 }) };
}

function splitInTwo(text: string): string[] {
  const middle = Math.ceil(text.length / 2);
  return [text.slice(0, middle), text.slice(middle)].filter(Boolean);
}
