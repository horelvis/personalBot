import type { Thread } from "../api/types.ts";
import { cn } from "../lib/utils.ts";

interface ThreadListProps {
  threads: Thread[];
  selectedId: string | null;
  onOpen: (thread: Thread) => void;
}

export function ThreadList({ threads, selectedId, onOpen }: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center">
        <p className="text-sm font-medium">No threads yet.</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-px">
      {threads.map((thread) => (
        <li key={thread.id}>
          {/* Row classes from openbot's channel row (app/src/components/app-sidebar/channel.tsx). */}
          <button
            type="button"
            aria-current={thread.id === selectedId}
            className={cn(
              "flex w-full items-center gap-2 truncate rounded-lg px-2 py-2 text-left text-sm hover:bg-foreground/5",
              thread.id === selectedId && "bg-foreground/5",
            )}
            onClick={() => onOpen(thread)}
          >
            {thread.title || "Untitled thread"}
          </button>
        </li>
      ))}
    </ul>
  );
}
