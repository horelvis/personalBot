import { useEffect, useMemo, useState } from "react";
import { type Api, createApi } from "./api/client.ts";
import type { Me } from "./api/types.ts";
import { AppSidebar, type Tab } from "./components/AppSidebar.tsx";
import { ErrorBanner } from "./components/ErrorBanner.tsx";
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
  if (me === undefined) return <p className="m-auto p-8 text-center text-sm text-muted-foreground">Loading…</p>;
  if (me === null) return <SignIn />;

  return (
    <div className="flex h-svh flex-col bg-background text-foreground md:flex-row">
      <AppSidebar me={me} tab={tab} onTab={setTab} onSignOut={signOut}>
        <ThreadsContainer
          api={api}
          selectedId={tab === "threads" ? threadId : null}
          onOpen={(thread) => {
            setThreadId(thread.id);
            setTab("threads");
          }}
        />
      </AppSidebar>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ErrorBanner message={error} />
        {tab === "memories" ? (
          <MemoriesContainer api={api} />
        ) : threadId ? (
          <ChatContainer key={threadId} api={api} threadId={threadId} />
        ) : (
          <p className="m-auto text-sm text-muted-foreground">Pick or start a thread.</p>
        )}
      </main>
    </div>
  );
}
