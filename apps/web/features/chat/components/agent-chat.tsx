"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Sparkles } from "lucide-react";
import { ComposerShell } from "./composer";
import { ChatThread } from "./chat-thread";
import { useChatSession } from "../hooks/use-chat-session";
import { chatInputFromComposer, capabilitiesForEntryMode } from "../services/conversation";
import { readAskDraft } from "../services/draft";
import { chatIdentityScope } from "../services/identity-scope";
import { getChatConfig, getChatSession } from "@/clients/backend/chat";
import { getLocalAskSession } from "../services/local-history";
import type { ChatAttachment, ChatModelId, ChatReplyMode, ComposerSubmitPayload, ChatConfig } from "@/types/ai-search";
import type { ComposerEntryMode } from "@/types";
import { DEFAULT_CHAT_MODEL } from "@/lib/data/chat-models";
import { useAuth } from "@/components/auth/auth-provider";

const SUGGESTIONS = [
  "帮我总结一下扩散模型在机器人控制中的最新进展",
  "RDT-1B 和 π0 的技术路线有什么差异?",
  "推荐几篇机器人基础模型方向值得精读的论文",
  "帮我起草一份关于操作泛化性的研究计划",
];

interface AgentChatProps {
  question?: string;
  initialMode?: ChatReplyMode;
  initialModel?: ChatModelId;
  initialWebSearch?: boolean;
}

export function AgentChat(props: AgentChatProps) {
  const { session, isPending } = useAuth();
  const [initialQuestionConsumed, setInitialQuestionConsumed] = useState(false);
  if (isPending) return <p className="p-6 text-sm text-muted">正在加载会话…</p>;
  return (
    <ChatWorkspace
      key={chatIdentityScope(session?.user.id)}
      {...props}
      question={initialQuestionConsumed ? "" : props.question}
      onInitialQuestion={() => setInitialQuestionConsumed(true)}
    />
  );
}

/** 对话历史统一在 AppSidebar；此处仅保留主对话区 */
function ChatWorkspace({
  question = "",
  initialMode,
  initialModel,
  initialWebSearch,
  onInitialQuestion,
}: AgentChatProps & { onInitialQuestion: () => void }) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<ChatReplyMode>(initialMode ?? "fast");
  const [model, setModel] = useState(initialModel ?? DEFAULT_CHAT_MODEL);
  const [webSearch, setWebSearch] = useState(Boolean(initialWebSearch));
  const [entryMode, setEntryMode] = useState<ComposerEntryMode>("ai");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [config, setConfig] = useState<ChatConfig>();
  const [composerVersion, setComposerVersion] = useState(0);
  const [showJump, setShowJump] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const { turns, busy, activeHistoryId, send, stop, resumeLast } = useChatSession();

  useEffect(() => {
    let live = true;
    void getChatConfig().then((loaded) => {
      if (!live) return;
      setConfig(loaded);
      const draft = readAskDraft(question);
      const preferred = initialModel ?? draft.model;
      const selected = loaded.models.some((m) => m.value === preferred && m.enabled)
        ? preferred
        : loaded.default_model ?? loaded.models.find((m) => m.enabled)?.value ?? preferred;
      setModel(selected);
      if (!question.trim()) return;
      const selectedMode = initialMode ?? draft.mode;
      const web = initialWebSearch ?? draft.web_search;
      setMode(selectedMode);
      setWebSearch(web);
      const capabilities = capabilitiesForEntryMode("ai");
      onInitialQuestion();
      void send({
        question,
        mode: selectedMode,
        model: selected,
        web_search: web,
        attachments: draft.attachments,
        capabilities,
      });
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (nearBottom.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    if (!activeHistoryId) return;
    if (activeHistoryId.startsWith("local_")) {
      const local = getLocalAskSession(activeHistoryId);
      if (local) {
        setMode(local.mode as ChatReplyMode);
        setModel(local.model as ChatModelId);
        setWebSearch(local.web_search);
        const enabled = local.knowledge_enabled ?? false;
        setEntryMode(enabled ? "ai" : "search");
      }
      return;
    }
    void getChatSession(activeHistoryId).then((session) => {
      setMode(session.mode);
      setModel(session.model);
      setWebSearch(session.web_search);
      setEntryMode(session.capabilities?.knowledge.enabled ? "ai" : "search");
    });
  }, [activeHistoryId]);

  const submit = (payload: ComposerSubmitPayload) => {
    if (busy) return;
    nearBottom.current = true;
    setValue("");
    setAttachments([]);
    const request = chatInputFromComposer(payload);
    setEntryMode(payload.entryMode);
    void send(request);
  };

  const followup = (text: string) => {
    submit({ entryMode, question: text, mode, model, web_search: webSearch, attachments: [] });
  };

  const composer = (
    <ComposerShell
      key={composerVersion}
      value={value}
      onChange={setValue}
      onSend={submit}
      placeholder="输入研究问题…"
      replyMode={mode}
      onReplyModeChange={setMode}
      model={model}
      onModelChange={setModel}
      webSearch={webSearch}
      onWebSearchChange={setWebSearch}
      attachments={attachments}
      onAttachmentsChange={setAttachments}
      entryMode={entryMode}
      onEntryModeChange={setEntryMode}
      config={config}
      busy={busy}
      onStop={() => void stop()}
    />
  );

  return (
    <div className="flex h-screen min-w-0 flex-1 flex-col">
      {turns.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-auto px-6">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
            <Sparkles className="size-6 text-primary" />
          </span>
          <h1 className="text-xl font-semibold text-ink">有什么我可以帮你研究的?</h1>
          <div className="w-full max-w-5xl">{composer}</div>
          <div className="flex max-w-5xl flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((text) => (
              <button
                key={text}
                type="button"
                disabled={busy}
                onClick={() => followup(text)}
                className="cursor-pointer rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:border-primary/40 hover:text-primary"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <header className="flex h-12 shrink-0 items-center border-b border-line px-6">
            <h1 className="truncate text-sm font-medium text-ink">{turns[0]?.content}</h1>
          </header>
          <div
            className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto"
            onScroll={(event) => {
              const element = event.currentTarget;
              nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
              setShowJump(!nearBottom.current);
            }}
          >
            <div className="mx-auto max-w-5xl space-y-5 px-6 py-8">
              <ChatThread turns={turns} busy={busy} onResume={() => void resumeLast()} onFollowup={followup} />
              <Link href={`/search?q=${encodeURIComponent(turns[0]?.content ?? "")}`} className="inline-block text-xs text-primary">
                相关论文
              </Link>
              <div ref={bottomRef} />
            </div>
          </div>
          <div className="relative px-6 pb-5 pt-2">
            {showJump && (
              <button
                type="button"
                aria-label="跳到最新"
                onClick={() => {
                  nearBottom.current = true;
                  bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                }}
                className="absolute -top-12 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-card text-muted shadow-pop"
              >
                <ChevronDown className="size-4" />
              </button>
            )}
            <div className="mx-auto max-w-5xl">{composer}</div>
          </div>
        </>
      )}
    </div>
  );
}
