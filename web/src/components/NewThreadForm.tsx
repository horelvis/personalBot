import { type FormEvent, useState } from "react";
import type { Bot } from "../api/types.ts";

interface NewThreadFormProps {
  bots: Bot[];
  disabled: boolean;
  onCreate: (input: { botId: string; title?: string }) => void;
}

export function NewThreadForm({ bots, disabled, onCreate }: NewThreadFormProps) {
  const [botId, setBotId] = useState("");
  const [title, setTitle] = useState("");
  const chosen = botId || bots[0]?.id || "";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!chosen) return;
    onCreate(title.trim() ? { botId: chosen, title: title.trim() } : { botId: chosen });
    setTitle("");
  }

  return (
    <form className="new-thread" onSubmit={submit}>
      <label>
        Bot
        <select value={chosen} onChange={(event) => setBotId(event.target.value)}>
          {bots.map((bot) => (
            <option key={bot.id} value={bot.id} title={bot.description ?? undefined}>
              {bot.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Title
        <input value={title} placeholder="Optional" onChange={(event) => setTitle(event.target.value)} />
      </label>
      <button type="submit" disabled={disabled || !chosen}>
        New thread
      </button>
    </form>
  );
}
