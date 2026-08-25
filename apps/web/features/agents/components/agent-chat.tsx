"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  MessageSquarePlus,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ComposerShell } from "./composer";
import { getSearchConfig } from "@/lib/api/search";
import { useAskSession } from "@/lib/ask/use-ask-session";
import { MarkdownContent } from "@b/lib/markdown-content";
import { DEFAULT_CHAT_MODEL } from "@/lib/data/chat-models";
import type {
  ChatAttachment,
  ChatModelId,
  ChatReplyMode,
  ComposerSubmitPayload,
  SearchConfig,
} from "@/types/ai-search";

/** 空状态的建议问题 */
const SUGGESTIONS = [
  "帮我总结一下扩散模型在机器人控制中的最新进展",
  "RDT-1B 和 π0 的技术路线有什么差异？",
  "推荐几篇机器人基础模型方向值得精读的论文",
  "帮我起草一份关于操作泛化性的研究计划",
];

/** AI 助手对话页 —— 接入 DeepSeek 流式 + 本地/DB 历史 */
export function AgentChat() {
  const [value, setValue] = useState("");
  const [replyMode, setReplyMode] = useState<ChatReplyMode>("fast");
  const [model, setModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL);
  const [webSearch, setWebSearch] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [config, setConfig] = useState<SearchConfig | undefined>();
  const [thoughtOpen, setThoughtOpen] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    turns,
    busy,
    send,
    stop,
    resumeLast,
    reset,
    historyItems,
    activeHistoryId,
    loadHistoryItem,
  } = useAskSession();

  useEffect(() => {
    void getSearchConfig().then(setConfig);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const displayTitle = useMemo(() => {
    const active = historyItems.find((h) => h.id === activeHistoryId);
    if (active) return active.title;
    const firstUser = turns.find((t) => t.role === "user");
    return firstUser?.content ?? "新对话";
  }, [activeHistoryId, historyItems, turns]);

  const submit = (question: string, files: ChatAttachment[] = []) => {
    const q = question.trim();
    if (!q || busy) return;
    void send({
      question: q,
      mode: replyMode,
      model,
      web_search: webSearch,
      attachments: files,
    });
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

  const historyPanel = (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-line bg-sidebar p-3">
      <button
        type="button"
        onClick={() => {
          reset();
          setValue("");
          setAttachments([]);
        }}
        className="flex h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-xl bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
      >
        <MessageSquarePlus className="size-4" strokeWidth={1.8} />
        新对话
      </button>
      <p className="shrink-0 px-3 pb-1.5 pt-4 text-[11px] font-medium tracking-wide text-faint">
        历史对话
      </p>
      <div className="scrollbar-subtle flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {historyItems.length === 0 ? (
          <p className="px-3 py-2 text-[12px] text-faint">暂无历史，发送消息后将自动保存</p>
        ) : (
          historyItems.map((item) => (
            <button
              key={`${item.source}-${item.id}`}
              type="button"
              aria-current={activeHistoryId === item.id ? "page" : undefined}
              onClick={() => loadHistoryItem(item)}
              className={cn(
                "flex h-9 shrink-0 cursor-pointer items-center rounded-lg px-3 text-left text-sm transition-colors",
                activeHistoryId === item.id
                  ? "bg-card font-medium text-primary shadow-sm"
                  : "text-muted hover:bg-card hover:text-ink-2",
              )}
            >
              <span className="truncate">{item.title}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );

  if (turns.length === 0 && !busy) {
    return (
      <div className="flex">
        {historyPanel}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col items-center justify-center gap-6 px-6">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
            <Sparkles className="size-6 text-primary" />
          </span>
          <h1 className="text-xl font-semibold text-ink">
            有什么我可以帮你研究的？
          </h1>
          <div className="w-full max-w-4xl">
            <ComposerShell
              value={value}
              onChange={setValue}
              onSend={onSend}
              placeholder="使用'@'引用或使用'/'唤起插件或技能…"
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
          <div className="flex max-w-4xl flex-wrap items-center justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="cursor-pointer rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:border-primary/40 hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      {historyPanel}
      <div className="flex h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center border-b border-line px-6">
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
            {displayTitle}
          </h1>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
            {turns.length === 0 && busy && (
              <p className="text-center text-[13px] text-muted">
                正在连接 DeepSeek…
              </p>
            )}
            {turns.map((turn) =>
              turn.role === "user" ? (
                <div key={turn.localId} className="flex justify-end">
                  <p className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-white">
                    {turn.content}
                  </p>
                </div>
              ) : (
                <div key={turn.localId} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                    <Sparkles className="size-4 text-primary" />
                  </span>
                  <div className="min-w-0 max-w-[80%] space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        setThoughtOpen((prev) => ({
                          ...prev,
                          [turn.localId]: !prev[turn.localId],
                        }))
                      }
                      className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg bg-panel px-2.5 text-[12px] text-muted transition-colors hover:bg-chip"
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
                      </span>
                      {thoughtOpen[turn.localId] ? (
                        <ChevronUp className="size-3.5 text-faint" />
                      ) : (
                        <ChevronDown className="size-3.5 text-faint" />
                      )}
                    </button>
                    {thoughtOpen[turn.localId] && turn.thought ? (
                      <p className="rounded-xl bg-panel px-3 py-2 text-[12px] text-muted">
                        {turn.thought}
                      </p>
                    ) : null}
                    {turn.content ? (
                      <div className="rounded-2xl rounded-tl-md bg-card px-4 py-3 text-sm text-ink shadow-card">
                        <MarkdownContent text={turn.content} />
                        {turn.status === "streaming" && (
                          <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-primary align-[-2px]" />
                        )}
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
                    {turn.followups.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          submit(item, [])
                        }
                        className="mr-2 mt-2 inline-flex rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:border-primary/40 hover:text-primary"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ),
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="px-6 pb-5">
          <div className="mx-auto max-w-5xl">
            <ComposerShell
              value={value}
              onChange={setValue}
              onSend={onSend}
              placeholder="使用'@'引用或使用'/'唤起插件或技能…"
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
