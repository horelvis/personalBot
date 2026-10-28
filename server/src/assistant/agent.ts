import type Anthropic from "@anthropic-ai/sdk";
import { AbstractAgent } from "@ag-ui/client";
import { type BaseEvent, EventType, type Message, type RunAgentInput, contentToText } from "@ag-ui/core";
import { Observable } from "rxjs";
import { type AssistantTool, toolDefinition } from "./tools.ts";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MAX_MODEL_CALLS_PER_RUN = 10;

const DEFAULT_SYSTEM =
  "You are the team's general assistant. Answer in the language the person writes in. " +
  "Be direct and say so when you do not know something.";

export interface AssistantOptions {
  client: Anthropic;
  model: string;
  system?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  tools?: AssistantTool[];
  /** Extra system text gathered once at the start of each run, such as the person's saved facts. */
  context?: () => Promise<string>;
}

export function createAssistant(options: AssistantOptions): AbstractAgent {
  return new Assistant(options);
}

type Emit = (event: Record<string, unknown> & { type: EventType }) => void;

/** The built-in bot: Claude behind the AG-UI agent interface, run in-process so its key never sits behind a public URL. */
class Assistant extends AbstractAgent {
  readonly #options: AssistantOptions;

  constructor(options: AssistantOptions) {
    super({ agentId: "assistant", description: "General assistant" });
    this.#options = options;
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      const abort = new AbortController();
      const emit: Emit = (event) => subscriber.next(event as BaseEvent);

      this.#runTurn(input, emit, abort.signal)
        .catch((error: unknown) => {
          emit({ type: EventType.RUN_ERROR, message: error instanceof Error ? error.message : String(error) });
        })
        .finally(() => subscriber.complete());

      return () => abort.abort();
    });
  }

  async #runTurn(input: RunAgentInput, emit: Emit, signal: AbortSignal): Promise<void> {
    const { client, model, system = DEFAULT_SYSTEM, effort = "medium", tools = [], context } = this.#options;
    emit({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId });

    // Built once per run and never changed inside it: rebuilding the system prompt or the tools
    // between calls in the same conversation invalidates Claude's earlier thinking.
    const extra = (await context?.()) ?? "";
    const systemBlocks: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: system }];
    if (extra) systemBlocks.push({ type: "text", text: extra });
    const toolDefinitions = tools.map(toolDefinition);
    const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
    const conversation = toAnthropicMessages(input.messages);

    for (let call = 0; call < MAX_MODEL_CALLS_PER_RUN; call++) {
      const stream = client.beta.messages.stream(
        {
          model,
          max_tokens: 64000,
          system: systemBlocks,
          messages: conversation,
          ...(toolDefinitions.length ? { tools: toolDefinitions } : {}),
          output_config: { effort },
          cache_control: { type: "ephemeral" },
          betas: [FALLBACK_BETA],
          fallbacks: "default",
        },
        { signal },
      );

      const messageId = crypto.randomUUID();
      let started = false;
      for await (const event of stream) {
        if (event.type !== "content_block_delta" || event.delta.type !== "text_delta" || !event.delta.text) continue;
        if (!started) {
          emit({ type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" });
          started = true;
        }
        emit({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: event.delta.text });
      }
      if (started) emit({ type: EventType.TEXT_MESSAGE_END, messageId });

      const response = await stream.finalMessage();
      if (response.stop_reason === "refusal") {
        emit({ type: EventType.RUN_ERROR, message: "The model declined this request." });
        return;
      }
      if (response.stop_reason !== "tool_use") {
        emit({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId });
        return;
      }

      // Thinking and every other block go back unchanged, so the history stays append-only.
      conversation.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        emit({ type: EventType.TOOL_CALL_START, toolCallId: block.id, toolCallName: block.name, parentMessageId: messageId });
        emit({ type: EventType.TOOL_CALL_ARGS, toolCallId: block.id, delta: JSON.stringify(block.input) });
        emit({ type: EventType.TOOL_CALL_END, toolCallId: block.id });

        const { content, isError } = await runTool(toolsByName.get(block.name), block.name, block.input);
        emit({ type: EventType.TOOL_CALL_RESULT, messageId: crypto.randomUUID(), toolCallId: block.id, content, role: "tool" });
        results.push({ type: "tool_result", tool_use_id: block.id, content, ...(isError ? { is_error: true } : {}) });
      }
      // All results of one turn go back in a single message.
      conversation.push({ role: "user", content: results });
    }

    emit({ type: EventType.RUN_ERROR, message: `Stopped after ${MAX_MODEL_CALLS_PER_RUN} model calls in one run.` });
  }
}

async function runTool(tool: AssistantTool | undefined, name: string, rawInput: unknown): Promise<{ content: string; isError: boolean }> {
  if (!tool) return { content: `Unknown tool ${name}.`, isError: true };
  const input = tool.input.safeParse(rawInput);
  if (!input.success) return { content: `Invalid input for ${name}: ${input.error.message}`, isError: true };
  try {
    return { content: await tool.run(input.data), isError: false };
  } catch (error) {
    return { content: `${name} failed: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
}

/** AG-UI history to Claude's turns: text, tool calls and tool results; other roles are left out. */
function toAnthropicMessages(messages: Message[]): Anthropic.Beta.BetaMessageParam[] {
  const turns: Anthropic.Beta.BetaMessageParam[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      const text = typeof message.content === "string" ? message.content : contentToText(message.content ?? []);
      if (text) turns.push({ role: "user", content: text });
    } else if (message.role === "assistant") {
      const text = message.content ?? "";
      if (!message.toolCalls?.length) {
        if (text) turns.push({ role: "assistant", content: text });
        continue;
      }
      const blocks: Anthropic.Beta.BetaContentBlockParam[] = text ? [{ type: "text", text }] : [];
      for (const toolCall of message.toolCalls) {
        blocks.push({ type: "tool_use", id: toolCall.id, name: toolCall.function.name, input: parseArguments(toolCall.function.arguments) });
      }
      turns.push({ role: "assistant", content: blocks });
    } else if (message.role === "tool") {
      const content = typeof message.content === "string" ? message.content : contentToText(message.content);
      const result: Anthropic.Beta.BetaToolResultBlockParam = { type: "tool_result", tool_use_id: message.toolCallId, content };
      if (message.error) result.is_error = true;
      const previous = turns.at(-1);
      // Results of the same turn share one user message.
      if (previous?.role === "user" && Array.isArray(previous.content) && previous.content.every((block) => block.type === "tool_result")) {
        previous.content.push(result);
      } else {
        turns.push({ role: "user", content: [result] });
      }
    }
  }
  return turns;
}

function parseArguments(serialized: string): unknown {
  try {
    return JSON.parse(serialized);
  } catch {
    return {};
  }
}
