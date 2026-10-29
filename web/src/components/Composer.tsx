import type { FormEvent } from "react";

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
    <form className="composer" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="composer-input">
        Message
      </label>
      <textarea
        id="composer-input"
        value={value}
        rows={2}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) submit(event);
        }}
      />
      <button type="submit" disabled={disabled || !value.trim()}>
        Send
      </button>
    </form>
  );
}
