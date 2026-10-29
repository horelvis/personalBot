// Row and empty-state classes adapted from CopilotKit/openbot (app/src/components/ui/item.tsx and ui/empty.tsx,
// commit 4766e42). Copyright (c) 2026 CopilotKit. MIT License; see web/NOTICE.
import type { Memory } from "../api/types.ts";
import { Button } from "./ui/button.tsx";

interface MemoryListProps {
  memories: Memory[];
  onDelete: (memory: Memory) => void;
}

export function MemoryList({ memories, onDelete }: MemoryListProps) {
  if (memories.length === 0) {
    return (
      <div className="flex min-h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
        <p className="text-sm font-medium tracking-tight">Nothing remembered yet.</p>
      </div>
    );
  }
  return (
    <ul className="flex w-full flex-col gap-2">
      {memories.map((memory) => (
        <li key={memory.id} className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3.5 text-sm dark:border-transparent dark:bg-muted/50">
          <span className="min-w-0 flex-1 leading-snug wrap-break-word">{memory.content}</span>
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={memory.createdAt}>
            {new Date(memory.createdAt).toLocaleDateString()}
          </time>
          <Button variant="destructive" size="sm" aria-label={`Forget: ${memory.content}`} onClick={() => onDelete(memory)}>
            Forget
          </Button>
        </li>
      ))}
    </ul>
  );
}
