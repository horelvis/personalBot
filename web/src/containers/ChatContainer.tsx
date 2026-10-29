import { useEffect, useState } from "react";
import type { Api } from "../api/client.ts";
import type { Message } from "../api/types.ts";
import { applyEvent } from "../chat/apply-event.ts";
import { Composer } from "../components/Composer.tsx";
import { ErrorBanner } from "../components/ErrorBanner.tsx";
import { MessageList } from "../components/MessageList.tsx";
import { describeError } from "./errors.ts";

export function ChatContainer({ api, threadId }: { api: Api; threadId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .messages(threadId)
      .then((history) => live && setMessages(history))
      .catch((reason) => live && setError(describeError(reason)));
    return () => {
      live = false;
    };
  }, [api, threadId]);

  async function send() {
    const message = { id: crypto.randomUUID(), content: draft.trim() };
    setDraft("");
    setError(null);
    setRunning(true);
    setMessages((current) => [...current, { ...message, role: "user" }]);
    let started = false;
    try {
      for await (const event of api.run(threadId, message)) {
        started = true;
        if (event.type === "RUN_ERROR") setError(String(event.message ?? "The run failed."));
        else setMessages((current) => applyEvent(current, event));
      }
    } catch (reason) {
      setError(describeError(reason));
      if (!started) {
        // The server refused the turn before storing it: take the message back into the composer.
        setMessages((current) => current.filter((existing) => existing.id !== message.id));
        setDraft(message.content);
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="chat">
      <MessageList messages={messages} />
      <ErrorBanner message={error} />
      <Composer value={draft} disabled={running} onChange={setDraft} onSubmit={send} />
    </section>
  );
}
