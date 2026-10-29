import { type FormEvent, useState } from "react";
import type { Bot } from "../api/types.ts";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";

interface NewThreadFormProps {
  bots: Bot[];
  disabled: boolean;
  onCreate: (input: { botId: string; title?: string }) => void;
}

// A native <select> drawn with the Input primitive's classes: openbot's Select is a Base UI popup.
const selectClasses =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

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
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <Label className="flex-col items-stretch gap-1.5 text-muted-foreground">
        Bot
        <select className={selectClasses} value={chosen} onChange={(event) => setBotId(event.target.value)}>
          {bots.map((bot) => (
            <option key={bot.id} value={bot.id} title={bot.description ?? undefined}>
              {bot.name}
            </option>
          ))}
        </select>
      </Label>
      <Label className="flex-col items-stretch gap-1.5 text-muted-foreground">
        Title
        <Input className="bg-background text-foreground" value={title} placeholder="Optional" onChange={(event) => setTitle(event.target.value)} />
      </Label>
      <Button type="submit" disabled={disabled || !chosen}>
        New thread
      </Button>
    </form>
  );
}
