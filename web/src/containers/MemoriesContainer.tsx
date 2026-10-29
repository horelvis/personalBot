import { useEffect, useState } from "react";
import type { Api } from "../api/client.ts";
import type { Memory } from "../api/types.ts";
import { ErrorBanner } from "../components/ErrorBanner.tsx";
import { MemoryForm } from "../components/MemoryForm.tsx";
import { MemoryList } from "../components/MemoryList.tsx";
import { describeError } from "./errors.ts";

export function MemoriesContainer({ api }: { api: Api }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .memories()
      .then((loaded) => live && setMemories(loaded))
      .catch((reason) => live && setError(describeError(reason)));
    return () => {
      live = false;
    };
  }, [api]);

  async function add(content: string) {
    setSaving(true);
    setError(null);
    try {
      const memory = await api.addMemory(content);
      setMemories((current) => [memory, ...current]);
    } catch (reason) {
      setError(describeError(reason));
    } finally {
      setSaving(false);
    }
  }

  async function remove(memory: Memory) {
    setError(null);
    try {
      await api.deleteMemory(memory.id);
      setMemories((current) => current.filter((existing) => existing.id !== memory.id));
    } catch (reason) {
      setError(describeError(reason));
    }
  }

  return (
    <section className="memories-page">
      <h2>Memories</h2>
      <p className="muted">Facts your bots keep about you. They can also add these themselves.</p>
      <MemoryForm disabled={saving} onAdd={add} />
      <ErrorBanner message={error} />
      <MemoryList memories={memories} onDelete={remove} />
    </section>
  );
}
