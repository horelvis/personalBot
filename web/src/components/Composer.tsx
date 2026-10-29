// Composer classes adapted from CopilotKit/openbot (app/src/components/channels/composer/composer.tsx,
// commit 4766e42). Copyright (c) 2026 CopilotKit. MIT License; see web/NOTICE.
import type { FormEvent } from "react";
import { Button } from "./ui/button.tsx";

interface ComposerProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function Composer({ value, disabled, onChange, onSubmit }: ComposerProps) {
  function submit(event: FormEvent) {
    event.preventDefault();
    if (value.trim() && !disabled) onSubmit();
  }
  return (
    <form
      className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
      onSubmit={submit}
    >
      <label className="sr-only" htmlFor="composer-input">
        Message
      </label>
      <textarea
        id="composer-input"
        className="field-sizing-content max-h-48 min-h-6 min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none outline-none placeholder:text-muted-foreground"
        placeholder="Ask anything"
        value={value}
        rows={1}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) submit(event);
        }}
      />
      <Button type="submit" size="icon" aria-label="Send" className="size-8 self-end rounded-full p-0" disabled={disabled || !value.trim()}>
        {/* Tabler's arrow-up, the icon openbot's send button draws. */}
        <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5l0 14" />
          <path d="M18 11l-6 -6" />
          <path d="M6 11l6 -6" />
        </svg>
      </Button>
    </form>
  );
}
