"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquarePlus, Star, Trash2 } from "lucide-react";
import { deleteChatSession, listChatSessions, updateChatSession } from "@/clients/backend/chat";
import type { ChatSessionSummary } from "@/types/ai-search";
import { messageForApiError } from "../services/errors";
import { cn } from "@/lib/utils";

/** B's history/favorite UI, backed by the same FastAPI session as generation. */
export function SessionList({ activeId, version, busy, onSelect, onNew }: {
  activeId: string | null; version: number; busy: boolean;
  onSelect: (id: string) => Promise<void>; onNew: () => Promise<void>;
}) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const refresh = useCallback(async () => {
    const data = await listChatSessions();
    setSessions(data.sessions);
  }, []);
  useEffect(() => {
    let live = true;
    void listChatSessions().then((data) => { if (live) setSessions(data.sessions); }, (error) => { if (live) setError(messageForApiError(error)); });
    return () => { live = false; };
  }, [version]);
  const action = async (fn: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true); setError("");
    try { await fn(); await refresh(); } catch (error) { setError(messageForApiError(error)); }
    finally { setPending(false); }
  };
  return <aside className="flex h-screen w-48 shrink-0 flex-col border-r border-line bg-sidebar p-3 max-md:w-40">
    <button type="button" disabled={pending} onClick={() => void action(onNew)} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-white"><MessageSquarePlus className="size-4" />新对话</button>
    <p className="px-2 pb-2 pt-4 text-xs text-muted">历史对话</p>
    <p className="mb-3 px-2 text-[11px] leading-5 text-faint">临时保存，服务重启或过期后清空</p>
    {error && <p role="alert" className="mb-2 text-xs text-muted">{error}</p>}
    <div className="scrollbar-subtle min-h-0 flex-1 space-y-1 overflow-y-auto">
      {sessions.map((session) => <div key={session.id} className={cn("group rounded-lg p-1", activeId === session.id ? "bg-card text-primary shadow-sm" : "text-muted hover:bg-card")}>
        <button type="button" disabled={pending} aria-current={activeId === session.id ? "page" : undefined} onClick={() => void action(() => onSelect(session.id))}
          className="w-full truncate px-2 py-2 text-left text-sm">{session.favorite ? "★ " : ""}{session.title}</button>
        <div className="flex justify-end gap-2 px-2 pb-1">
          <button type="button" disabled={pending || busy} aria-label={`${session.favorite ? "取消收藏" : "收藏"}会话 ${session.title}`} onClick={() => void action(() => updateChatSession(session.id, { favorite: !session.favorite }))}><Star className={cn("size-3.5", session.favorite && "fill-current")} /></button>
          <button type="button" disabled={pending || busy} aria-label={`删除会话 ${session.title}`} onClick={() => {
            if (window.confirm(`删除会话「${session.title}」？`)) void action(async () => {
              await deleteChatSession(session.id);
              if (activeId === session.id) await onNew();
            });
          }}><Trash2 className="size-3.5" /></button>
        </div>
      </div>)}
      {!sessions.length && <p className="px-2 text-xs text-faint">暂无历史会话</p>}
    </div>
  </aside>;
}
