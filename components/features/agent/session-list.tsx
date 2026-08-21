/**
 * components/features/agent/session-list.tsx — 左侧历史会话列表（Task 16）
 * ---------------------------------------------------------------------
 * 从 GET /api/sessions 拉取最近 20 条；支持标题关键字过滤、重命名、软删。
 * 点击某项 → onSelect(session) 回灌（Task 17 在 AgentChat 中实现）。
 * 匿名用户（401）→ 显示"登录后可保存历史"提示，不报错。
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquarePlus,
  Pencil,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  deleteSession,
  listSessions,
  renameSession,
  type SessionListItem,
} from "@/lib/api/sessions";

/* ---------------- 相对时间 ---------------- */
function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

/* ---------------- 组件 ---------------- */
export function SessionList({
  activeId,
  onSelect,
  onNew,
}: {
  activeId: string | null;
  onSelect: (s: SessionListItem) => void;
  onNew: () => void;
}) {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [anonymous, setAnonymous] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listSessions();
      setSessions(list);
      setAnonymous(false);
    } catch (e) {
      // 401 未登录 → 提示登录；其他错误静默（历史栏不阻塞主流程）
      const status = (e as { status?: number })?.status;
      setAnonymous(status === 401);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 首次进入编辑态自动 focus
  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  const startEdit = (s: SessionListItem) => {
    setEditingId(s.id);
    setDraftTitle(s.title);
  };

  const commitEdit = async (id: string) => {
    const title = draftTitle.trim();
    setEditingId(null);
    if (!title) return;
    // 乐观更新
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s)),
    );
    try {
      await renameSession(id, title);
    } catch {
      refresh(); // 失败回滚
    }
  };

  const remove = async (s: SessionListItem) => {
    if (!window.confirm(`确定删除「${s.title}」？`)) return;
    // 乐观移除（500ms opacity 动画由 CSS 处理，这里直接删除）
    setSessions((prev) => prev.filter((x) => x.id !== s.id));
    try {
      await deleteSession(s.id);
    } catch {
      refresh();
    }
  };

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-line bg-sidebar p-3">
      <button
        type="button"
        onClick={onNew}
        className="flex h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-xl bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
      >
        <MessageSquarePlus className="size-4" strokeWidth={1.8} />
        新对话
      </button>

      {/* 搜索框 */}
      <div className="mt-3 flex shrink-0 items-center gap-2 rounded-lg border border-line bg-card px-2.5">
        <Search className="size-3.5 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索历史…"
          className="h-8 w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
        />
      </div>

      <p className="shrink-0 px-1 pb-1.5 pt-3 text-[11px] font-medium tracking-wide text-faint">
        历史对话
      </p>

      <div className="scrollbar-subtle flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-1.5 px-1 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-chip" />
            ))}
          </div>
        ) : anonymous ? (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <UserRound className="size-5 text-faint" />
            <p className="text-[12px] leading-relaxed text-muted">
              登录后可保存并同步你的对话历史
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-faint">
            {sessions.length === 0 ? "还没有历史对话" : "无匹配结果"}
          </p>
        ) : (
          filtered.map((s) => (
            <div
              key={s.id}
              className={cn(
                "group relative flex h-11 shrink-0 items-center rounded-lg px-2 transition-colors",
                activeId === s.id ? "bg-primary-soft" : "hover:bg-chip",
              )}
            >
              {editingId === s.id ? (
                <input
                  ref={editRef}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onBlur={() => commitEdit(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit(s.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="h-8 w-full rounded-md border border-primary/40 bg-card px-2 text-[13px] text-ink outline-none"
                />
              ) : (
                <>
                  <button
                    type="button"
                    aria-current={activeId === s.id ? "page" : undefined}
                    onClick={() => onSelect(s)}
                    className="min-w-0 flex-1 cursor-pointer text-left"
                  >
                    <span className="block truncate text-[13px] text-ink-2">
                      {s.title}
                    </span>
                    <span className="block text-[10.5px] text-faint">
                      {relativeTime(s.updatedAt)}
                      {s.messageCount > 0 && ` · ${s.messageCount} 条`}
                    </span>
                  </button>
                  {/* hover 操作：编辑 / 删除 */}
                  <div className="absolute right-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title="重命名"
                      onClick={() => startEdit(s)}
                      className="cursor-pointer rounded p-1 text-faint hover:bg-chip hover:text-ink-2"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title="删除"
                      onClick={() => remove(s)}
                      className="cursor-pointer rounded p-1 text-faint hover:bg-rose-50 hover:text-rose-500"
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
