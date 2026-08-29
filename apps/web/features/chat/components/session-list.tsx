"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquarePlus,
  Pencil,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { deleteChatSession, listChatSessions, updateChatSession } from "@/clients/backend/chat";
import type { ChatSessionSummary } from "@/types/ai-search";
import { messageForApiError } from "../services/errors";
import { cn } from "@/lib/utils";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

/** Agent B 风格页面内会话侧栏：搜索 / 收藏 / 重命名 / 删除 */
export function SessionList({ activeId, version, busy, onSelect, onNew }: {
  activeId: string | null;
  version: number;
  busy: boolean;
  onSelect: (id: string) => Promise<void>;
  onNew: () => Promise<void>;
}) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listChatSessions();
      setSessions(data.sessions);
      setError("");
    } catch (err) {
      setError(messageForApiError(err));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, version]);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  const action = async (fn: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(messageForApiError(err));
    } finally {
      setPending(false);
    }
  };

  const startEdit = (session: ChatSessionSummary) => {
    setEditingId(session.id);
    setDraftTitle(session.title);
  };

  const commitEdit = async (id: string) => {
    const title = draftTitle.trim();
    setEditingId(null);
    if (!title) return;
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
    try {
      await updateChatSession(id, { title });
    } catch {
      await refresh();
    }
  };

  return (
    <aside className="hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-sidebar p-3 lg:flex">
      <button
        type="button"
        disabled={pending}
        onClick={() => void action(onNew)}
        className="flex h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-xl bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
      >
        <MessageSquarePlus className="size-4" strokeWidth={1.8} />
        新对话
      </button>

      <div className="mt-3 flex shrink-0 items-center gap-2 rounded-lg border border-line bg-card px-2.5">
        <Search className="size-3.5 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索历史…"
          className="h-8 w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
        />
      </div>

      <p className="shrink-0 px-1 pb-1.5 pt-3 text-[11px] font-medium tracking-wide text-faint">历史对话</p>
      <p className="mb-2 px-1 text-[10px] leading-4 text-faint">服务重启后临时会话会清空</p>
      {error && <p role="alert" className="mb-2 px-1 text-[11px] text-muted">{error}</p>}

      <div className="scrollbar-subtle flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-1.5 px-1 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-chip" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-faint">
            {sessions.length === 0 ? "还没有历史对话" : "无匹配结果"}
          </p>
        ) : (
          filtered.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group relative flex min-h-11 shrink-0 items-center rounded-lg px-2 transition-colors",
                activeId === session.id ? "bg-primary-soft" : "hover:bg-chip",
              )}
            >
              {editingId === session.id ? (
                <input
                  ref={editRef}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onBlur={() => void commitEdit(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void commitEdit(session.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="h-8 w-full rounded-md border border-primary/40 bg-card px-2 text-[13px] text-ink outline-none"
                />
              ) : (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    aria-current={activeId === session.id ? "page" : undefined}
                    onClick={() => void action(() => onSelect(session.id))}
                    className="min-w-0 flex-1 cursor-pointer pr-20 text-left"
                  >
                    <span className="flex items-center gap-1 truncate text-[13px] text-ink-2">
                      {session.favorite && <Star className="size-3 shrink-0 fill-current text-primary" />}
                      {session.title}
                    </span>
                    <span className="block text-[10.5px] text-faint">{relativeTime(session.updated_at)}</span>
                  </button>
                  <div className="absolute right-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title={session.favorite ? "取消收藏" : "收藏"}
                      disabled={pending || busy}
                      onClick={() => void action(() => updateChatSession(session.id, { favorite: !session.favorite }))}
                      className="rounded-md bg-card p-1 text-faint shadow-sm ring-1 ring-line/60 hover:text-primary"
                    >
                      <Star className={cn("size-3.5", session.favorite && "fill-current text-primary")} />
                    </button>
                    <button
                      type="button"
                      title="重命名"
                      disabled={pending}
                      onClick={() => startEdit(session)}
                      className="rounded-md bg-card p-1 text-faint shadow-sm ring-1 ring-line/60 hover:text-primary"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title="删除"
                      disabled={pending || busy}
                      onClick={() => {
                        if (!window.confirm(`删除会话「${session.title}」？`)) return;
                        void action(async () => {
                          await deleteChatSession(session.id);
                          if (activeId === session.id) await onNew();
                        });
                      }}
                      className="rounded-md bg-card p-1 text-faint shadow-sm ring-1 ring-line/60 hover:text-rose-500"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
