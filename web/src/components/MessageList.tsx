// Transcript classes adapted from CopilotKit/openbot (app/src/components/ui/bubble.tsx, ui/message.tsx and
// channels/chat-transcript.tsx, commit 4766e42). Copyright (c) 2026 CopilotKit. MIT License; see web/NOTICE.
import type { Message } from "../api/types.ts";

export function MessageList({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return <p className="m-auto text-sm text-muted-foreground">Say hello to start.</p>;
  }
  return (
    <ol className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6" aria-live="polite">
      {messages.map((message) =>
        message.role === "tool" ? (
          <li key={message.id} className="min-w-0 text-sm text-muted-foreground">
            <details className="my-1.5 min-w-0">
              <summary className="cursor-pointer select-none">Tool result</summary>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-3 text-xs">{message.content}</pre>
            </details>
          </li>
        ) : message.role === "user" ? (
          // A person's message: openbot's `muted` bubble, aligned to the end, as wide as its words.
          <li key={message.id} className="flex min-w-0 justify-end">
            <div className="w-fit max-w-[80%] min-w-0 rounded-xl bg-muted px-3 py-2 text-sm leading-relaxed wrap-break-word">
              {message.content ? <p className="whitespace-pre-wrap">{message.content}</p> : null}
            </div>
          </li>
        ) : (
          // A bot's message: openbot's `ghost` bubble, the whole column wide.
          <li key={message.id} className="flex w-full min-w-0 flex-col gap-1 text-sm leading-relaxed wrap-break-word">
            {message.content ? <p className="whitespace-pre-wrap">{message.content}</p> : null}
            {message.toolCalls?.map((call) => (
              <p key={call.id} className="text-muted-foreground">
                Using tool <code className="font-mono text-xs">{call.function.name}</code>
              </p>
            ))}
          </li>
        ),
      )}
    </ol>
  );
}
