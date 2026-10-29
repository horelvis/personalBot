// Select classes adapted from CopilotKit/openbot (app/src/components/ui/input.tsx, commit 4766e42).
// Copyright (c) 2026 CopilotKit. MIT License; see web/NOTICE.
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
// `appearance-none` drops the browser's own inner padding and arrow, so the text lines up with the
// Input below it; the chevron is drawn instead.
const selectClasses =
  "h-9 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

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
        <span className="relative">
          <select className={selectClasses} value={chosen} onChange={(event) => setBotId(event.target.value)}>
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id} title={bot.description ?? undefined}>
                {bot.name}
              </option>
            ))}
          </select>
          {/* Tabler's chevron-down. */}
          <svg aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6l6 -6" />
          </svg>
        </span>
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
