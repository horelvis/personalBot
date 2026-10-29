import { useEffect, useState } from "react";
import type { Api } from "../api/client.ts";
import type { Bot, Thread } from "../api/types.ts";
import { ErrorBanner } from "../components/ErrorBanner.tsx";
import { NewThreadForm } from "../components/NewThreadForm.tsx";
import { ThreadList } from "../components/ThreadList.tsx";
import { describeError } from "./errors.ts";

interface ThreadsContainerProps {
  api: Api;
  selectedId: string | null;
  onOpen: (thread: Thread) => void;
}

export function ThreadsContainer({ api, selectedId, onOpen }: ThreadsContainerProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([api.threads(), api.bots()])
      .then(([loadedThreads, loadedBots]) => {
        if (!live) return;
        setThreads(loadedThreads);
        setBots(loadedBots);
      })
      .catch((reason) => live && setError(describeError(reason)));
    return () => {
      live = false;
    };
  }, [api]);

  async function create(input: { botId: string; title?: string }) {
    setCreating(true);
    setError(null);
    try {
      const thread = await api.createThread(input);
      setThreads((current) => [thread, ...current]);
      onOpen(thread);
    } catch (reason) {
      setError(describeError(reason));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <NewThreadForm bots={bots} disabled={creating} onCreate={create} />
      <ErrorBanner message={error} />
      <ThreadList threads={threads} selectedId={selectedId} onOpen={onOpen} />
    </div>
  );
}
