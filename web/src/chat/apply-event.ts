import type { Message, RunEvent } from "../api/types.ts";

/** Folds one streamed AG-UI event into the thread's messages; events that change nothing return them as is. */
export function applyEvent(messages: Message[], event: RunEvent): Message[] {
  switch (event.type) {
    case "TEXT_MESSAGE_START":
      return upsert(messages, String(event.messageId), (message) => message);
    case "TEXT_MESSAGE_CONTENT":
      return upsert(messages, String(event.messageId), (message) => ({
        ...message,
        content: (message.content ?? "") + String(event.delta ?? ""),
      }));
    case "TOOL_CALL_START": {
      const toolCall = { id: String(event.toolCallId), type: "function" as const, function: { name: String(event.toolCallName), arguments: "" } };
      return upsert(messages, String(event.parentMessageId ?? event.toolCallId), (message) => ({
        ...message,
        toolCalls: [...(message.toolCalls ?? []), toolCall],
      }));
    }
    case "TOOL_CALL_ARGS":
      return messages.map((message) => {
        if (!message.toolCalls?.some((call) => call.id === event.toolCallId)) return message;
        const toolCalls = message.toolCalls.map((call) =>
          call.id === event.toolCallId ? { ...call, function: { ...call.function, arguments: call.function.arguments + String(event.delta ?? "") } } : call,
        );
        return { ...message, toolCalls };
      });
    case "TOOL_CALL_RESULT":
      return [...messages, { id: String(event.messageId), role: "tool", toolCallId: String(event.toolCallId), content: String(event.content ?? "") }];
    default:
      return messages;
  }
}

function upsert(messages: Message[], id: string, change: (message: Message) => Message): Message[] {
  if (!messages.some((message) => message.id === id)) return [...messages, change({ id, role: "assistant", content: "" })];
  return messages.map((message) => (message.id === id ? change(message) : message));
}
