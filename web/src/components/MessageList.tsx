import type { Message } from "../api/types.ts";

export function MessageList({ messages }: { messages: Message[] }) {
  if (messages.length === 0) return <p className="muted">Say hello to start.</p>;
  return (
    <ol className="messages" aria-live="polite">
      {messages.map((message) =>
        message.role === "tool" ? (
          <li key={message.id} className="message tool">
            <details>
              <summary>Tool result</summary>
              <pre>{message.content}</pre>
            </details>
          </li>
        ) : (
          <li key={message.id} className={`message ${message.role}`}>
            {message.content ? <p>{message.content}</p> : null}
            {message.toolCalls?.map((call) => (
              <p key={call.id} className="tool-call">
                Using tool <code>{call.function.name}</code>
              </p>
            ))}
          </li>
        ),
      )}
    </ol>
  );
}
