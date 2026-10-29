import { useEffect, useMemo, useState } from "react";
import { type Api, createApi } from "./api/client.ts";
import type { Me } from "./api/types.ts";
import { ErrorBanner } from "./components/ErrorBanner.tsx";
import { Header, type Tab } from "./components/Header.tsx";
import { SignIn } from "./components/SignIn.tsx";
import { ChatContainer } from "./containers/ChatContainer.tsx";
import { MemoriesContainer } from "./containers/MemoriesContainer.tsx";
import { ThreadsContainer } from "./containers/ThreadsContainer.tsx";
import { describeError } from "./containers/errors.ts";

export function App({ api: given }: { api?: Api }) {
  const api = useMemo(() => given ?? createApi(), [given]);
  // undefined while loading, null when nobody is signed in.
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("threads");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.me().then(setMe, (reason) => setError(describeError(reason)));
  }, [api]);

  async function signOut() {
    try {
      await api.signOut();
      setMe(null);
      setThreadId(null);
    } catch (reason) {
      setError(describeError(reason));
    }
  }

  if (error && me === undefined) return <ErrorBanner message={error} />;
  if (me === undefined) return <p className="muted">Loading…</p>;
  if (me === null) return <SignIn />;

  return (
    <div className="app">
      <Header me={me} tab={tab} onTab={setTab} onSignOut={signOut} />
      <ErrorBanner message={error} />
      {tab === "memories" ? (
        <MemoriesContainer api={api} />
      ) : (
        <main className="workspace">
          <ThreadsContainer api={api} selectedId={threadId} onOpen={(thread) => setThreadId(thread.id)} />
          {threadId ? <ChatContainer key={threadId} api={api} threadId={threadId} /> : <p className="muted">Pick or start a thread.</p>}
        </main>
      )}
    </div>
  );
}
