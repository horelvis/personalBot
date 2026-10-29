export interface Me {
  id: string;
  email: string;
  name: string | null;
}

export interface Bot {
  id: string;
  name: string;
  description: string | null;
}

export interface Thread {
  id: string;
  botId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** An AG-UI message as the server stores and returns it. */
export interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface Memory {
  id: string;
  content: string;
  createdAt: string;
}

/** The AG-UI events the web app reacts to; anything else passes through untyped. */
export type RunEvent =
  | { type: "TEXT_MESSAGE_START"; messageId: string }
  | { type: "TEXT_MESSAGE_CONTENT"; messageId: string; delta: string }
  | { type: "TOOL_CALL_START"; toolCallId: string; toolCallName: string; parentMessageId?: string }
  | { type: "TOOL_CALL_ARGS"; toolCallId: string; delta: string }
  | { type: "TOOL_CALL_RESULT"; messageId: string; toolCallId: string; content: string }
  | { type: "RUN_ERROR"; message: string }
  | { type: string; [key: string]: unknown };
