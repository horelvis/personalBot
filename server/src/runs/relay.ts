import type { AbstractAgent } from "@ag-ui/client";
import { type BaseEvent, EventType, type Message } from "@ag-ui/core";
import { EventEncoder } from "@ag-ui/encoder";
import type { ThreadStore } from "../threads/store.ts";

export interface RelayTurn {
  threads: ThreadStore;
  /** A fresh agent for this run: an HttpAgent for a bot reached by URL, or a built-in one. */
  agent: AbstractAgent;
  threadId: string;
  runId: string;
  /** Called once the run is over, whatever its outcome. */
  release: () => Promise<void>;
}

/**
 * Runs one turn against an AG-UI agent with the history from our database and streams its events
 * back as SSE. The run belongs to the server: it finishes and is stored even if the browser leaves.
 */
export async function relayTurn({ threads, agent, threadId, runId, release }: RelayTurn): Promise<ReadableStream<Uint8Array>> {
  const history: Message[] = await threads.history(threadId);
  const encoder = new EventEncoder();
  const bytes = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      let reportedError = false;
      const send = (event: BaseEvent) => {
        if (event.type === EventType.RUN_ERROR) reportedError = true;
        if (!open) return;
        try {
          controller.enqueue(bytes.encode(encoder.encodeSSE(event)));
        } catch {
          open = false; // The browser went away; keep running and storing.
        }
      };

      try {
        agent.threadId = threadId;
        agent.setMessages(history);
        const result = await agent.runAgent({ runId }, { onEvent: ({ event }) => send(event) });
        await threads.append(threadId, result.newMessages);
      } catch (error) {
        if (!reportedError) {
          send({ type: EventType.RUN_ERROR, message: error instanceof Error ? error.message : String(error) } as BaseEvent);
        }
      } finally {
        await threads.touch(threadId);
        await release();
        if (open) controller.close();
      }
    },
  });
}
