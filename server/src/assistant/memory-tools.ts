import { z } from "zod";
import type { MemoryStore } from "../memory/store.ts";
import { type AssistantTool, defineTool } from "./tools.ts";

export function memoryTools(memories: MemoryStore, ownerId: string): AssistantTool[] {
  return [
    defineTool({
      name: "remember",
      description:
        "Save a lasting fact about the person you are talking to (a preference, their role, a name) so it is available in future conversations. One fact per call, written as a short sentence.",
      input: z.object({ fact: z.string().trim().min(1).max(500) }),
      async run({ fact }) {
        await memories.add(ownerId, fact);
        return "Remembered.";
      },
    }),
    defineTool({
      name: "recall",
      description: "Search the facts saved about the person by keywords.",
      input: z.object({ query: z.string().trim().min(1).max(200) }),
      async run({ query }) {
        const found = await memories.search(ownerId, query);
        return found.length ? found.map((memory) => `- ${memory.content}`).join("\n") : "Nothing saved matches that.";
      },
    }),
  ];
}
