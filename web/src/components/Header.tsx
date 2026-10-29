import type { Me } from "../api/types.ts";

export type Tab = "threads" | "memories";

interface HeaderProps {
  me: Me;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onSignOut: () => void;
}

export function Header({ me, tab, onTab, onSignOut }: HeaderProps) {
  return (
    <header className="header">
      <strong>personalBot</strong>
      <nav>
        <button type="button" aria-pressed={tab === "threads"} onClick={() => onTab("threads")}>
          Threads
        </button>
        <button type="button" aria-pressed={tab === "memories"} onClick={() => onTab("memories")}>
          Memories
        </button>
      </nav>
      <span className="who">
        {me.name ? `${me.name} · ` : ""}
        <span>{me.email}</span>
      </span>
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
    </header>
  );
}
