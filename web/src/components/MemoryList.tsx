import type { Memory } from "../api/types.ts";

interface MemoryListProps {
  memories: Memory[];
  onDelete: (memory: Memory) => void;
}

export function MemoryList({ memories, onDelete }: MemoryListProps) {
  if (memories.length === 0) return <p className="muted">Nothing remembered yet.</p>;
  return (
    <ul className="memories">
      {memories.map((memory) => (
        <li key={memory.id}>
          <span>{memory.content}</span>
          <time dateTime={memory.createdAt}>{new Date(memory.createdAt).toLocaleDateString()}</time>
          <button type="button" aria-label={`Forget: ${memory.content}`} onClick={() => onDelete(memory)}>
            Forget
          </button>
        </li>
      ))}
    </ul>
  );
}
