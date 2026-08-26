"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { listLocalAskSessions } from "@/lib/ask/local-history";
import { listSessions } from "@b/lib/api/sessions";
import {
  useAskSidebarBridge,
  type SidebarChatHistoryItem,
} from "@/stores/ask-sidebar-bridge";

function mergeHistory(
  db: Awaited<ReturnType<typeof listSessions>>,
  local: ReturnType<typeof listLocalAskSessions>,
): SidebarChatHistoryItem[] {
  return [
    ...db.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: new Date(s.updatedAt).getTime(),
      source: "db" as const,
    })),
    ...local.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt,
      source: "local" as const,
    })),
  ].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** AI 助手展开区内的「新对话 + 最近」；embedded 时作为 ExpandableNav footer */
export function SidebarChatHistory({
  collapsed,
  variant = "standalone",
}: {
  collapsed?: boolean;
  variant?: "standalone" | "embedded";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const bridgeItems = useAskSidebarBridge((s) => s.historyItems);
  const activeId = useAskSidebarBridge((s) => s.activeHistoryId);
  const requestLoad = useAskSidebarBridge((s) => s.requestLoad);
  const requestNewChat = useAskSidebarBridge((s) => s.requestNewChat);
  const [fetched, setFetched] = useState<SidebarChatHistoryItem[]>([]);

  const refresh = useCallback(() => {
    void listSessions()
      .then((db) => setFetched(mergeHistory(db, listLocalAskSessions())))
      .catch(() => setFetched(mergeHistory([], listLocalAskSessions())));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  const items = bridgeItems.length > 0 ? bridgeItems : fetched;
  const onAgentRoute =
    pathname === "/agents" ||
    pathname.startsWith("/agents/ask") ||
    pathname.startsWith("/agents/b");

  const openSession = (item: SidebarChatHistoryItem) => {
    requestLoad(item);
    if (pathname !== "/agents") router.push("/agents");
  };

  const newChat = () => {
    requestNewChat();
    router.push("/agents");
  };

  if (collapsed) {
    return (
      <Link
        href="/agents"
        title="新对话"
        className="flex h-10 shrink-0 items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-card"
      >
        <MessageSquarePlus className="size-[18px]" strokeWidth={1.8} />
      </Link>
    );
  }

  const embedded = variant === "embedded";

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-0.5",
        embedded && "mt-1 border-t border-line/50 pt-1",
      )}
    >
      <button
        type="button"
        onClick={newChat}
        className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-card"
      >
        <MessageSquarePlus className="size-4 shrink-0" strokeWidth={1.8} />
        新对话
      </button>
      <p className="shrink-0 px-3 pb-0.5 pt-2 text-[11px] font-medium tracking-wide text-faint">
        最近
      </p>
      <div className="scrollbar-subtle max-h-40 space-y-0.5 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-1.5 text-[12px] leading-snug text-faint">
            暂无对话
          </p>
        ) : (
          items.slice(0, 16).map((item) => (
            <button
              key={`${item.source}-${item.id}`}
              type="button"
              title={item.title}
              aria-current={
                onAgentRoute && activeId === item.id ? "page" : undefined
              }
              onClick={() => openSession(item)}
              className={cn(
                "flex h-9 w-full cursor-pointer items-center rounded-lg px-3 text-left text-sm transition-colors",
                onAgentRoute && activeId === item.id
                  ? "bg-card font-medium text-primary shadow-sm"
                  : "text-muted hover:bg-card hover:text-ink-2",
              )}
            >
              <span className="truncate">{item.title}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
