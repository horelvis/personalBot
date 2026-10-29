type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

export interface FakeFetch {
  fetch: typeof fetch;
  calls: { method: string; path: string; body: unknown }[];
}

/** A fetch that answers "METHOD /path" from a table and records every request. */
export function fakeFetch(routes: Record<string, Handler>): FakeFetch {
  const calls: FakeFetch["calls"] = [];
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, path, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    const handler = routes[`${method} ${path}`];
    if (!handler) return json({ error: "Not found" }, 404);
    return handler(init);
  };
  return { fetch: fetchFn as typeof fetch, calls };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** An SSE response whose body arrives in exactly these chunks, so tests can split events anywhere. */
export function sse(chunks: string[]): Response {
  const bytes = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(bytes.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

export const event = (value: object) => `data: ${JSON.stringify(value)}\n\n`;
