"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  MessageSquarePlus,
  MoreHorizontal,
} from "lucide-react";
import { ComposerShell } from "@/features/chat/components/composer";
import { getSearchConfig } from "@/clients/backend/search";
import { readAskDraft } from "@/features/chat/services/draft";
import { useAskSession } from "@/features/chat/hooks/use-chat-session";
import type {
  ChatAttachment,
  ChatModelId,
  ChatReplyMode,
  ComposerSubmitPayload,
  SearchConfig,
} from "@/types/ai-search";
import { DEFAULT_CHAT_MODEL } from "@/lib/data/chat-models";

function titleOf(question: string) {
  const q = question.trim() || "问 AI";
  return q.length > 24 ? `${q.slice(0, 24)}…` : q;
}

export function AskStage({
  question,
  initialMode,
  initialModel,
  initialWebSearch,
}: {
  question: string;
  initialMode?: ChatReplyMode;
  initialModel?: ChatModelId;
  initialWebSearch?: boolean;
}) {
  const q = question.trim() || "Diffusion Policy 有什么创新？";

  const [value, setValue] = useState("");
  const [replyMode, setReplyMode] = useState<ChatReplyMode>(
    initialMode ?? "fast",
  );
  const [model, setModel] = useState<ChatModelId>(
    initialModel ?? DEFAULT_CHAT_MODEL,
  );
  const [webSearch, setWebSearch] = useState(Boolean(initialWebSearch));
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [config, setConfig] = useState<SearchConfig | undefined>();
  const [thoughtOpen, setThoughtOpen] = useState<Record<string, boolean>>({});
  const [showJump, setShowJump] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { turns, busy, send, stop, resumeLast, reset } = useAskSession();

  useEffect(() => {
    void getSearchConfig().then(setConfig);
  }, []);

  useEffect(() => {
    const draft = readAskDraft(question);
    const mode = initialMode ?? draft.mode;
    const mdl = initialModel ?? draft.model;
    const web = initialWebSearch ?? draft.web_search;
    const files = draft.attachments;
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      setReplyMode(mode);
      setModel(mdl);
      setWebSearch(web);
      setAttachments(files);
      void send(
        {
          question: q,
          mode,
          model: mdl,
          web_search: web,
          attachments: files,
        },
        ac.signal,
      );
    }, 0);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
    // 首问只在进入页面时发一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const scrollToLatest = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowJump(false);
  };

  const onSend = (payload: ComposerSubmitPayload) => {
    if (payload.entryMode === "search") return;
    setValue("");
    setAttachments([]);
    void send({
      question: payload.question,
      mode: payload.mode,
      model: payload.model,
      web_search: payload.web_search,
      attachments: payload.attachments,
    });
  };

  return (
    <div className="flex">
      <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-line bg-sidebar p-3">
        <button
          type="button"
          onClick={() => {
            reset();
            window.location.assign("/agents/ask");
          }}
          className="flex h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-full bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
        >
          <MessageSquarePlus className="size-4" strokeWidth={1.8} />
          新对话
        </button>
        <p className="px-3 pb-1.5 pt-4 text-[11px] font-medium tracking-wide text-faint">
          今天
        </p>
        <button
          type="button"
          className="flex h-9 w-full cursor-pointer items-center rounded-lg bg-card px-3 text-left text-sm font-medium text-primary shadow-sm"
        >
          <span className="truncate">{titleOf(q)}</span>
        </button>
      </aside>

      <div className="flex h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-6">
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
            {titleOf(q)}
          </h1>
          <button
            type="button"
            aria-label="更多"
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-chip"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </header>

        <div
          ref={scrollerRef}
          className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto"
          onScroll={() => {
            const el = scrollerRef.current;
            if (!el) return;
            setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 96);
          }}
        >
          <div className="mx-auto max-w-3xl space-y-4 px-6 py-8">
            {turns.length === 0 && busy && (
              <p className="text-center text-[13px] text-muted">
                正在连接生成服务…
              </p>
            )}
            {turns.map((turn) =>
              turn.role === "user" ? (
                <div key={turn.localId} className="flex justify-center">
                  <p className="max-w-2xl rounded-full bg-chip px-5 py-2.5 text-center text-sm leading-relaxed text-ink">
                    {turn.content}
                  </p>
                </div>
              ) : (
                <div key={turn.localId} className="space-y-3">
                  <button
                    type="button"
                    onClick={() =>
                      setThoughtOpen((prev) => ({
                        ...prev,
                        [turn.localId]: !prev[turn.localId],
                      }))
                    }
                    className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-xl bg-panel px-3 text-[13px] text-muted transition-colors hover:bg-chip"
                  >
                    {turn.status === "streaming" ? (
                      <LoaderCircle className="size-3.5 animate-spin text-primary" />
                    ) : (
                      <Check className="size-3.5 text-success" />
                    )}
                    <span className="flex-1 text-left">
                      {turn.status === "streaming"
                        ? turn.thought || "思考中"
                        : turn.status === "stopped"
                          ? "已停止"
                          : turn.status === "failed"
                            ? "生成失败"
                            : "思考完成"}
                      {typeof turn.readCount === "number"
                        ? ` · 已阅读 ${turn.readCount} 篇`
                        : ""}
                      {typeof turn.durationMs === "number"
                        ? ` · ${(turn.durationMs / 1000).toFixed(1)}s`
                        : ""}
                    </span>
                    {thoughtOpen[turn.localId] ? (
                      <ChevronUp className="size-3.5 text-faint" />
                    ) : (
                      <ChevronDown className="size-3.5 text-faint" />
                    )}
                  </button>
                  {thoughtOpen[turn.localId] && (
                    <p className="rounded-xl bg-panel px-3 py-2 text-[13px] leading-relaxed text-muted">
                      {turn.thought || "无思考摘要"}
                    </p>
                  )}
                  {turn.content ? (
                    <div className="whitespace-pre-wrap text-sm leading-7 text-ink">
                      {turn.content}
                    </div>
                  ) : null}
                  {turn.error ? (
                    <div className="rounded-xl border border-line bg-panel px-3 py-2 text-[13px] text-muted">
                      {turn.error}
                      <button
                        type="button"
                        onClick={() => void resumeLast()}
                        className="ml-2 text-primary hover:underline"
                      >
                        继续
                      </button>
                    </div>
                  ) : null}
                  {turn.references.length > 0 && (
                    <ul className="space-y-1.5">
                      {turn.references.map((ref) => (
                        <li
                          key={`${ref.ordinal}-${ref.source_id}`}
                          className="rounded-xl border border-line bg-card px-3 py-2 text-[13px] text-ink-2"
                        >
                          [{ref.ordinal}] {ref.title}
                          {ref.authors ? ` · ${ref.authors}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {turn.followups.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() =>
                        void send({
                          question: item,
                          mode: replyMode,
                          model,
                          web_search: webSearch,
                          attachments: [],
                        })
                      }
                      className="mr-2 inline-flex rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ),
            )}
            <Link
              href={`/search?q=${encodeURIComponent(q)}`}
              className="inline-flex rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:border-primary/40 hover:text-primary"
            >
              相关论文
            </Link>
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="relative overflow-visible px-6 pb-5 pt-2">
          {showJump && (
            <button
              type="button"
              aria-label="跳到最新"
              onClick={scrollToLatest}
              className="absolute -top-12 left-1/2 flex size-9 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-line bg-card text-muted shadow-pop hover:text-ink"
            >
              <ChevronDown className="size-4" />
            </button>
          )}
          <div className="mx-auto max-w-3xl">
            <ComposerShell
              value={value}
              onChange={setValue}
              onSend={onSend}
              placeholder="Ask anything about research… 使用 '@' 引用论文"
              replyMode={replyMode}
              onReplyModeChange={setReplyMode}
              model={model}
              onModelChange={setModel}
              webSearch={webSearch}
              onWebSearchChange={setWebSearch}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              config={config}
              busy={busy}
              onStop={stop}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
