import type Anthropic from "@anthropic-ai/sdk";
import { AbstractAgent } from "@ag-ui/client";
import { type BaseEvent, EventType, type Message, type RunAgentInput, contentToText } from "@ag-ui/core";
import { Observable } from "rxjs";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

const DEFAULT_SYSTEM =
  "You are the team's general assistant. Answer in the language the person writes in. " +
  "Be direct and say so when you do not know something.";

export interface AssistantOptions {
  client: Anthropic;
  model: string;
  system?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

export function createAssistant(options: AssistantOptions): AbstractAgent {
  return new Assistant(options);
}

/** The built-in bot: Claude behind the AG-UI agent interface, run in-process so its key never sits behind a public URL. */
class Assistant extends AbstractAgent {
  readonly #options: AssistantOptions;

  constructor(options: AssistantOptions) {
    super({ agentId: "assistant", description: "General assistant" });
    this.#options = options;
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    const { client, model, system = DEFAULT_SYSTEM, effort = "medium" } = this.#options;
    return new Observable<BaseEvent>((subscriber) => {
      const abort = new AbortController();
      const emit = (event: Record<string, unknown> & { type: EventType }) => subscriber.next(event as BaseEvent);

      (async () => {
        emit({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId });
        const stream = client.beta.messages.stream(
          {
            model,
            max_tokens: 64000,
            system,
            messages: toAnthropicMessages(input.messages),
            output_config: { effort },
            betas: [FALLBACK_BETA],
            fallbacks: "default",
          },
          { signal: abort.signal },
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

        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          emit({ type: EventType.RUN_ERROR, message: "The model declined this request." });
        } else {
          emit({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId });
        }
        subscriber.complete();
      })().catch((error: unknown) => {
        emit({ type: EventType.RUN_ERROR, message: error instanceof Error ? error.message : String(error) });
        subscriber.complete();
      });

      return () => abort.abort();
    });
  }
}

/** AG-UI history to Claude's turns. Only conversation text for now; tool turns arrive with the tools. */
function toAnthropicMessages(messages: Message[]): Anthropic.Beta.BetaMessageParam[] {
  const turns: Anthropic.Beta.BetaMessageParam[] = [];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = typeof message.content === "string" ? message.content : contentToText(message.content ?? []);
    if (text) turns.push({ role: message.role, content: text });
  }
  return turns;
}
