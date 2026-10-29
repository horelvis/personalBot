import { readSseJson } from "./sse.ts";
import type { Bot, Me, Memory, Message, RunEvent, Thread } from "./types.ts";

/** A failed request, with the server's status and its `error` text when it sent one. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** The web app's port to the server: every request it makes goes through here. */
export function createApi(fetchFn: typeof fetch = (...args) => globalThis.fetch(...args)) {
  async function request(method: string, path: string, body?: unknown): Promise<Response> {
    const response = await fetchFn(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new ApiError(response.status, await errorText(response));
    return response;
  }

  const json = async <T>(method: string, path: string, body?: unknown) => (await request(method, path, body)).json() as Promise<T>;

  return {
    /** The signed-in person, or null when nobody is signed in. */
    async me(): Promise<Me | null> {
      try {
        return await json<Me>("GET", "/api/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    async signOut(): Promise<void> {
      await request("POST", "/auth/logout");
    },
    bots: () => json<Bot[]>("GET", "/api/bots"),
    threads: () => json<Thread[]>("GET", "/api/threads"),
    createThread: (input: { botId: string; title?: string }) => json<Thread>("POST", "/api/threads", input),
    messages: (threadId: string) => json<Message[]>("GET", `/api/threads/${encodeURIComponent(threadId)}/messages`),
    /** Sends a message and yields the run's AG-UI events as they arrive. */
    async *run(threadId: string, message: { id: string; content: string }): AsyncGenerator<RunEvent> {
      const response = await request("POST", `/api/threads/${encodeURIComponent(threadId)}/runs`, { message });
      if (!response.body) return;
      for await (const event of readSseJson(response.body)) yield event as RunEvent;
    },
    memories: () => json<Memory[]>("GET", "/api/memories"),
    addMemory: (content: string) => json<Memory>("POST", "/api/memories", { content }),
    async deleteMemory(id: string): Promise<void> {
      await request("DELETE", `/api/memories/${encodeURIComponent(id)}`);
    },
  };
}

export type Api = ReturnType<typeof createApi>;

async function errorText(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // Not JSON; fall back to the status.
  }
  return `Request failed (${response.status})`;
}
