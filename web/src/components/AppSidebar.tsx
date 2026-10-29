// Layout and classes adapted from CopilotKit/openbot (app/src/components/app-sidebar/app-sidebar.tsx
// and app/src/components/ui/sidebar.tsx, commit 4766e42). Copyright (c) 2026 CopilotKit. MIT License; see web/NOTICE.
import type { ReactNode } from "react";
import type { Me } from "../api/types.ts";
import { cn } from "../lib/utils.ts";
import { Button } from "./ui/button.tsx";

export type Tab = "threads" | "memories";

interface AppSidebarProps {
  me: Me;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onSignOut: () => void;
  /** The conversations: what openbot's roster shows between the header and the footer. */
  children: ReactNode;
}

const navRow = "flex h-10 w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-foreground/5";

export function AppSidebar({ me, tab, onTab, onSignOut, children }: AppSidebarProps) {
  return (
    <aside className="flex max-h-[45svh] w-full shrink-0 flex-col bg-sidebar text-sidebar-foreground md:h-svh md:max-h-none md:w-64">
      <header className="flex h-12 shrink-0 items-center p-2">
        <strong className="px-2 text-[14px] leading-tight font-semibold tracking-tighter">personalBot</strong>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">{children}</div>
      <footer className="flex shrink-0 flex-col gap-px p-2">
        <nav className="flex flex-col gap-px">
          {(["threads", "memories"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={tab === item}
              className={cn(navRow, tab === item && "bg-foreground/5")}
              onClick={() => onTab(item)}
            >
              {item === "threads" ? "Threads" : "Memories"}
            </button>
          ))}
        </nav>
        <div className="flex h-10 items-center gap-2 px-2">
          <UserAvatar me={me} />
          {/* Name over email, as two lines, so the email is not cut off in a 16rem sidebar. */}
          <span className="flex min-w-0 flex-1 flex-col leading-tight" title={me.email}>
            {me.name ? <span className="truncate text-sm font-medium tracking-tight">{me.name}</span> : null}
            <span className="truncate text-xs text-muted-foreground">{me.email}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </footer>
    </aside>
  );
}

function UserAvatar({ me }: { me: Me }) {
  const initials = (me.name || me.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <div
      aria-hidden="true"
      className="flex size-[28px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted-foreground/10 text-xs text-foreground/70"
    >
      {initials}
    </div>
  );
}
