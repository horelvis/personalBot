import { type FormEvent, useState } from "react";

export function MemoryForm({ disabled, onAdd }: { disabled: boolean; onAdd: (content: string) => void }) {
  const [content, setContent] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    onAdd(content.trim());
    setContent("");
  }
  return (
    <form className="memory-form" onSubmit={submit}>
      <label>
        New memory
        <input value={content} maxLength={2000} onChange={(event) => setContent(event.target.value)} />
      </label>
      <button type="submit" disabled={disabled || !content.trim()}>
        Remember
      </button>
    </form>
  );
}
