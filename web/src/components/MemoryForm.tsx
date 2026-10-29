import { type FormEvent, useState } from "react";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";

export function MemoryForm({ disabled, onAdd }: { disabled: boolean; onAdd: (content: string) => void }) {
  const [content, setContent] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    onAdd(content.trim());
    setContent("");
  }
  return (
    <form className="flex items-end gap-2" onSubmit={submit}>
      <Label className="flex-1 flex-col items-stretch gap-1.5 text-muted-foreground">
        New memory
        <Input className="text-foreground" value={content} maxLength={2000} onChange={(event) => setContent(event.target.value)} />
      </Label>
      <Button type="submit" disabled={disabled || !content.trim()}>
        Remember
      </Button>
    </form>
  );
}
