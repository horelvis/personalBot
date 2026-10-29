import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createApi } from "../src/api/client.ts";
import { App } from "../src/App.tsx";
import { ChatContainer } from "../src/containers/ChatContainer.tsx";
import { MemoriesContainer } from "../src/containers/MemoriesContainer.tsx";
import { ThreadsContainer } from "../src/containers/ThreadsContainer.tsx";
import { event, fakeFetch, json, sse } from "./fake-fetch.ts";

const me = { id: "u1", email: "ada@example.com", name: "Ada" };
const thread = { id: "t1", botId: "assistant", title: "Plans", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" };

describe("App", () => {
  it("shows a sign-in screen that navigates to /auth/login when /api/me answers 401", async () => {
    const { fetch } = fakeFetch({ "GET /api/me": () => json({ error: "Sign in required" }, 401) });
    render(<App api={createApi(fetch)} />);
    const link = await screen.findByRole("link", { name: "Sign in" });
    expect(link.getAttribute("href")).toBe("/auth/login");
  });

  it("shows who is signed in and signs out", async () => {
    const fake = fakeFetch({
      "GET /api/me": () => json(me),
      "GET /api/threads": () => json([]),
      "GET /api/bots": () => json([]),
      "POST /auth/logout": () => new Response(null, { status: 204 }),
    });
    render(<App api={createApi(fake.fetch)} />);
    expect(await screen.findByText("ada@example.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(fake.calls.some((call) => call.method === "POST" && call.path === "/auth/logout")).toBe(true);
  });
});

describe("ThreadsContainer", () => {
  it("lists threads and creates one with the chosen bot", async () => {
    const created = { ...thread, id: "t2", botId: "helper", title: "Taxes" };
    const fake = fakeFetch({
      "GET /api/threads": () => json([thread]),
      "GET /api/bots": () => json([
        { id: "assistant", name: "Assistant", description: "General" },
        { id: "helper", name: "Helper", description: null },
      ]),
      "POST /api/threads": () => json(created, 201),
    });
    const opened: string[] = [];
    render(<ThreadsContainer api={createApi(fake.fetch)} selectedId={null} onOpen={(t) => opened.push(t.id)} />);

    expect(await screen.findByRole("button", { name: "Plans" })).toBeTruthy();
    fireEvent.change(await screen.findByLabelText("Bot"), { target: { value: "helper" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Taxes" } });
    fireEvent.click(screen.getByRole("button", { name: "New thread" }));

    expect(await screen.findByRole("button", { name: "Taxes" })).toBeTruthy();
    expect(fake.calls.find((call) => call.method === "POST")?.body).toEqual({ botId: "helper", title: "Taxes" });
    expect(opened).toEqual(["t2"]);
  });
});

describe("ChatContainer", () => {
  const history = [
    { id: "m1", role: "user", content: "Hello" },
    { id: "m2", role: "assistant", content: "Hi, how can I help?" },
  ];

  function send(text: string) {
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  }

  it("renders the history and streams the reply from SSE deltas, even when a chunk splits an event", async () => {
    const reply = [
      event({ type: "RUN_STARTED", threadId: "t1", runId: "r1" }),
      event({ type: "TEXT_MESSAGE_START", messageId: "a1", role: "assistant" }),
      event({ type: "TEXT_MESSAGE_CONTENT", messageId: "a1", delta: "Sure, " }),
      event({ type: "TEXT_MESSAGE_CONTENT", messageId: "a1", delta: "tomorrow at 9." }),
      event({ type: "TEXT_MESSAGE_END", messageId: "a1" }),
      event({ type: "RUN_FINISHED", threadId: "t1", runId: "r1" }),
    ].join("");
    const cut = reply.indexOf("tomorrow") - 4; // inside the second delta's line
    const fake = fakeFetch({
      "GET /api/threads/t1/messages": () => json(history),
      "POST /api/threads/t1/runs": () => sse([reply.slice(0, cut), reply.slice(cut)]),
    });
    render(<ChatContainer api={createApi(fake.fetch)} threadId="t1" />);

    expect(await screen.findByText("Hi, how can I help?")).toBeTruthy();
    send("Book a meeting");
    expect(await screen.findByText("Book a meeting")).toBeTruthy();
    expect(await screen.findByText("Sure, tomorrow at 9.")).toBeTruthy();
    const body = fake.calls.find((call) => call.method === "POST")?.body as { message: { id: string; content: string } };
    expect(body.message.content).toBe("Book a meeting");
    expect(body.message.id).toBeTruthy();
  });

  it("shows the message of a RUN_ERROR", async () => {
    const fake = fakeFetch({
      "GET /api/threads/t1/messages": () => json([]),
      "POST /api/threads/t1/runs": () => sse([event({ type: "RUN_STARTED" }), event({ type: "RUN_ERROR", message: "Model unavailable" })]),
    });
    render(<ChatContainer api={createApi(fake.fetch)} threadId="t1" />);
    await waitFor(() => expect(fake.calls.length).toBe(1));
    send("Hi");
    expect((await screen.findByRole("alert")).textContent).toBe("Model unavailable");
  });

  it("tells the person when the thread is busy (409)", async () => {
    const fake = fakeFetch({
      "GET /api/threads/t1/messages": () => json([]),
      "POST /api/threads/t1/runs": () => json({ error: "Thread t1 is busy" }, 409),
    });
    render(<ChatContainer api={createApi(fake.fetch)} threadId="t1" />);
    await waitFor(() => expect(fake.calls.length).toBe(1));
    send("Hi");
    expect((await screen.findByRole("alert")).textContent).toMatch(/busy/i);
  });
});

describe("MemoriesContainer", () => {
  it("lists, adds and deletes memories", async () => {
    let memories = [{ id: "k1", content: "Prefers mornings", createdAt: "2026-10-01T00:00:00Z" }];
    const fake = fakeFetch({
      "GET /api/memories": () => json(memories),
      "POST /api/memories": (init) => {
        const added = { id: "k2", content: JSON.parse(String(init?.body)).content, createdAt: "2026-10-02T00:00:00Z" };
        memories = [added, ...memories];
        return json(added, 201);
      },
      "DELETE /api/memories/k1": () => {
        memories = memories.filter((memory) => memory.id !== "k1");
        return new Response(null, { status: 204 });
      },
    });
    render(<MemoriesContainer api={createApi(fake.fetch)} />);

    expect(await screen.findByText("Prefers mornings")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("New memory"), { target: { value: "Lives in Madrid" } });
    fireEvent.click(screen.getByRole("button", { name: "Remember" }));
    expect(await screen.findByText("Lives in Madrid")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Forget: Prefers mornings" }));
    await waitFor(() => expect(screen.queryByText("Prefers mornings")).toBeNull());
    expect(fake.calls.some((call) => call.method === "DELETE" && call.path === "/api/memories/k1")).toBe(true);
    expect(screen.getByText("Lives in Madrid")).toBeTruthy();
  });
});
