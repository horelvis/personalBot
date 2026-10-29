import type { Thread } from "../api/types.ts";

interface ThreadListProps {
  threads: Thread[];
  selectedId: string | null;
  onOpen: (thread: Thread) => void;
}

export function ThreadList({ threads, selectedId, onOpen }: ThreadListProps) {
  if (threads.length === 0) return <p className="muted">No threads yet.</p>;
  return (
    <ul className="thread-list">
      {threads.map((thread) => (
        <li key={thread.id}>
          <button type="button" aria-current={thread.id === selectedId} onClick={() => onOpen(thread)}>
            {thread.title || "Untitled thread"}
          </button>
        </li>
      ))}
    </ul>
  );
}
