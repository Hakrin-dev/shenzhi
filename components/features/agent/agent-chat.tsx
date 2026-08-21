"use client";

/**
 * B 模块 —— AI 助手对话页 agent-chat.tsx（2026-08-17 全面对齐 A 模块契约）
 * UPDATE: 2026-08-18 A+B 单前端整合
 *   —— 底部 <ComposerShell/> 现已接入 useComposerStore，props 签名升级为完整 13+ 项
 *     （busy / model / attachments / entryMode / onAttachmentsChange 等），
 *     与 A 模块 search-hero.tsx 的调用契约保持一致，避免 TS 报错
 *     "Property 'isStreaming' does not exist" 等兼容问题已通过 busy prop 统一
 * 修改日志：任务日志/对于A的修改/2026.8.18-A+B整合单前端化修改.md
 *
 * 完整能力清单（对应 A 模块 ask-stage.tsx 全功能）：
 *  P0（必达）
 *   ✅ 1. 解析 URL 四参数 ?q=&mode=&model=&web_search=（严格对齐 A 的 askQueryString）
 *   ✅ 2. 读取 sessionStorage 草稿 shenzhi.chat.draft（匹配 question 才生效，含 attachments）
 *   ✅ 3. 参数合法值校验：mode ∈ {fast, deep, idea, doubt}（B 层用 inspire→idea 的映射读取）
 *   ✅ 4. 两步法会话（createChatSession → streamChatMessage）通过 useAskSession
 *   ✅ 5. 6 种 SSE 事件 → UI（meta/delta/refs/followups/done/error）
 *   ✅ 6. 错误码 20001~20010 + NGROK/TIMEOUT 统一展示（lib/ask/errors.ts）
 *   ✅ 7. A→B 自动首问（autoLaunchedRef + StrictMode cleanup 复位）
 *
 *  P2（体验对齐 A）
 *   ✅ 8. 思考状态折叠面板（phase/read_count/context_truncated）
 *   ✅ 9. 停止生成（AbortController + stopChatMessage）+ 「继续」按钮（resumeLast）
 *   ✅ 10. 引用卡片（编号配色：source_type→tone；推荐=琥珀色；点击跳转）
 *   ✅ 11. followups 追问建议 chips
 *   ✅ 12. 生成耗时显示（done.duration_ms）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BookOpenCheck,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  MessageSquarePlus,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ComposerShell } from "./composer";
import { CWebSearchProvider } from "./c-web-search-provider";
import { ReferenceGrid } from "./reference-grid";
import { CitationProvider, CitationContent } from "@/lib/citations";
import { useAskSession, type AskStreamCallbacks } from "@/lib/chat-stream";
import { useComposerStore } from "@/stores/composer";
import { mapToAMode, mapToBStyle } from "@/lib/api/search";
import {
  asMode,
  asModel,
  asWebSearch,
  clearAskDraft,
  readAskDraft,
  toBAttachment,
} from "@/lib/ask/draft";
import { normalizeAIError } from "@/lib/ask/errors";
import type {
  ChatMessage,
  ChatStyle,
  ChatUIMessage,
} from "@/types";

/* =========================================================
 *  常量
 * ======================================================= */

const SUGGESTIONS = [
  "帮我总结一下扩散模型在机器人控制中的最新进展",
  "RDT-1B 和 π0 的技术路线有什么差异？",
  "推荐几篇机器人基础模型方向值得精读的论文",
  "帮我起草一份关于操作泛化性的研究计划",
];

const HISTORY = [
  "长上下文 Transformer 调研",
  "NeurIPS 2026 投稿筛选",
  "扩散模型效率优化",
  "操作泛化性研究计划",
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* =========================================================
 *  子组件：打字机占位点点点
 * ======================================================= */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className="size-1.5 animate-bounce rounded-full bg-ink-3 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-ink-3 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-ink-3" />
    </span>
  );
}

/* =========================================================
 *  子组件：思考状态折叠面板（A 模块「thinking」的实现）
 * ======================================================= */
function ThinkingPanel({
  phase,
  readCount,
  durationMs,
  truncated,
  warnings,
}: {
  phase?: "检索中" | "正在生成" | "warning" | (string & {});
  readCount?: number;
  durationMs?: number;
  truncated?: boolean;
  /** 附件截断告警（Task 3 新增：ATTACHMENT_TRUNCATED_30K / 60K） */
  warnings?: Array<{ code: string; message: string; files?: string[] }>;
}) {
  const [open, setOpen] = useState(true);
  const items = useMemo(() => {
    const arr: { icon: typeof Sparkles; label: string; value?: string; tone?: "danger" }[] = [];
    if (phase && phase !== "warning") arr.push({ icon: Sparkles, label: "阶段", value: phase });
    if (phase === "warning") {
      arr.push({
        icon: AlertTriangle,
        label: "状态",
        value: "有告警信息（见下方）",
        tone: "danger",
      });
    }
    if (typeof readCount === "number")
      arr.push({
        icon: BookOpenCheck,
        label: "已阅读",
        value:
          readCount === 0
            ? "检索中…"
            : readCount === 1
              ? "1 篇"
              : `${readCount} 篇`,
      });
    if (typeof durationMs === "number")
      arr.push({
        icon: Timer,
        label: "耗时",
        value: `${(durationMs / 1000).toFixed(1)}s`,
      });
    if (truncated)
      arr.push({
        icon: AlertTriangle,
        label: "上下文",
        value: "已截断（超长输入被裁剪）",
        tone: "danger",
      });
    return arr;
  }, [phase, readCount, durationMs, truncated]);

  // 合并外部传入 warnings（附件截断）+ phase=warning 时的告警
  const warningItems = (warnings ?? []).filter(Boolean);
  const hasAnyWarning = warningItems.length > 0 || phase === "warning" || truncated;
  // 保留变量（后续用于思考面板右上角红点指示器）
  void hasAnyWarning;

  if (items.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-sidebar/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="size-3.5 text-faint" />
        ) : (
          <ChevronRight className="size-3.5 text-faint" />
        )}
        <span className="text-[12px] font-medium text-ink-2">思考状态</span>
        {phase && (
          <span className="ml-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {phase}
          </span>
        )}
        {!phase && typeof durationMs === "number" && (
          <span className="ml-1 text-[11px] text-faint">
            {(durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </button>
      {open && (
        <div className="border-t border-line/70 px-3 py-2 space-y-2.5">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {items.map((it) => (
              <div
                key={it.label}
                className={cn(
                  "flex items-center gap-1.5 text-[12px]",
                  it.tone === "danger" ? "text-rose-600 dark:text-rose-400" : "text-muted",
                )}
              >
                <it.icon
                  className={cn(
                    "size-3.5 shrink-0",
                    it.tone === "danger"
                      ? "text-rose-500 dark:text-rose-400"
                      : "text-faint",
                  )}
                />
                <span className="text-faint">{it.label}:</span>
                <span className="font-medium text-ink-2">{it.value}</span>
              </div>
            ))}
          </div>

          {/* 附件截断告警（Task 3 思考面板告警新增） */}
          {warningItems.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-rose-200/70 bg-rose-50/60 p-2 dark:border-rose-900/40 dark:bg-rose-950/20">
              {warningItems.map((w, i) => (
                <div
                  key={`${w.code}-${i}`}
                  className="flex items-start gap-1.5 text-[12px] leading-relaxed"
                >
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                  <div className="min-w-0">
                    <div className="font-medium text-rose-700 dark:text-rose-300">
                      {w.code === "ATTACHMENT_TRUNCATED_30K"
                        ? "单附件超 3 万字，已截断"
                        : w.code === "ATTACHMENT_OVERALL_TRUNCATED_60K"
                          ? "多附件合计超 6 万字，部分未注入"
                          : w.code}
                    </div>
                    <div className="mt-0.5 text-rose-700/90 dark:text-rose-300/90">
                      {w.message}
                    </div>
                    {w.files && w.files.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {w.files.map((f) => (
                          <span
                            key={f}
                            className="rounded border border-rose-200 bg-white/60 px-1.5 py-0.5 text-[10.5px] text-rose-600 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-300"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// UPDATE: 2026-08-21 已移到 ThinkingPanel 函数体内 void 引用；模块域占位保留避免 diff 空行
void 0;

/* =========================================================
 *  Task 4 · 子组件：R1 深度思考折叠面板
 *   - 流式中默认展开；结束后默认折叠
 *   - 显示「深度思考中…」badge + token 计数
 *   - 超长内容按 max-h-[380px] 滚动，避免长思考链撑高首屏
 * ======================================================= */
function ReasoningChainPanel({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  // 流式中默认展开；已完成默认折叠（首屏不被长思考链占用）
  const [open, setOpen] = useState(Boolean(streaming));
  useEffect(() => {
    // streaming 切换时同步展开状态
    if (streaming) setOpen(true);
  }, [streaming]);

  const tokens = Array.from(content).length;
  if (!content) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-primary-soft/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="size-3.5 text-faint" />
        ) : (
          <ChevronRight className="size-3.5 text-faint" />
        )}
        <BrainCircuit className="size-3.5 text-primary" />
        <span className="text-[12px] font-medium text-ink-2">深度思考</span>
        <span className="ml-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {streaming ? "思考中…" : "已完成"}
        </span>
        <span className="ml-auto text-[11px] text-faint">{tokens} 字</span>
      </button>
      {open && (
        <div className="border-t border-primary/10 bg-white/50 p-3 dark:bg-ink-950/20">
          <div className="max-h-[380px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white/80 p-3 text-[12.5px] leading-6 text-ink-2 shadow-inner ring-1 ring-line/60 dark:bg-ink-950/40">
            {content}
            {streaming && (
              <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-primary align-[-2px]" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
 *  子组件：FollowUps 追问 chips（对齐 A 的 follow-ups.tsx）
 * ======================================================= */
function FollowUpsBar({
  items,
  onPick,
}: {
  items: string[];
  onPick: (q: string) => void;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-faint">
        你可能还想问
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onPick(q)}
            className="cursor-pointer rounded-full border border-line bg-card px-3.5 py-1.5 text-[12px] text-muted transition-colors hover:border-primary/40 hover:text-primary"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
 *  子组件：错误气泡（按 20001~20010 / NGROK / TIMEOUT 分类）
 * ======================================================= */
function ErrorBubble({
  code,
  message,
  onRetry,
  onResume,
  canResume,
}: {
  code: string;
  message: string;
  onRetry: () => void;
  onResume: () => void;
  canResume: boolean;
}) {
  const hint = normalizeAIError({ code, message });
  return (
    <div className="rounded-2xl rounded-tl-md border border-red-200/70 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/30">
      <div className="mb-2 flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-red-800 dark:text-red-200">
            {hint.title}
          </p>
          <p className="mt-1 break-all text-[12px] text-red-700/90 dark:text-red-300/90">
            <span className="font-mono text-[11px] opacity-70">[{hint.code}]</span>{" "}
            {message}
          </p>
          {hint.action && (
            <p className="mt-2 whitespace-pre-line rounded-lg bg-white/70 p-2 text-[12px] leading-relaxed text-red-900/90 dark:bg-black/20 dark:text-red-100/90">
              {hint.action}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {canResume && code === "20004" && (
          <button
            type="button"
            onClick={onResume}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-primary/90"
          >
            <Play className="size-3" />
            继续生成
          </button>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-red-700"
        >
          <RefreshCw className="size-3" />
          重新提问
        </button>
      </div>
    </div>
  );
}

/* =========================================================
 *  主组件 AgentChat
 * ======================================================= */
export function AgentChat() {
  /* ---------- 1. URL 参数 + 草稿读取（A→B 传参） ---------- */
  const searchParams = useSearchParams();
  // URL 参数（A 模块 askQueryString 构造）
  const urlQ = searchParams.get("q") ?? "";
  const urlMode = searchParams.get("mode"); // fast | deep | idea | doubt（A 协议命名）
  const urlModel = searchParams.get("model"); // default | subscription | byok | 任意
  const urlWebSearch = searchParams.get("web_search"); // "1" / "0"

  const [activeConv, setActiveConv] = useState<string | null>(null);

  /* ---------- 2. 对话状态 ---------- */
  const [messages, setMessages] = useState<ChatUIMessage[]>([]);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /** backendMsgId → index in messages[] 的映射（流式事件回调快速定位） */
  const msgIdIdxRef = useRef<Map<string, number>>(new Map());

  /* ---------- 3. Composer 共享状态总线 ---------- */
  const storeModel = useComposerStore((s) => s.model);
  const storeStyle = useComposerStore((s) => s.style);
  const storeWebSearch = useComposerStore((s) => s.webSearch);
  const storeAttachments = useComposerStore((s) => s.attachments);
  const storeWebSearchFn = useComposerStore((s) => s.webSearchFn);
  const composerMessage = useComposerStore((s) => s.message);
  const setComposerMessage = useComposerStore((s) => s.setMessage);
  const setComposerModel = useComposerStore((s) => s.setModel);
  const setComposerStyle = useComposerStore((s) => s.setStyle);
  const setComposerWebSearch = useComposerStore((s) => s.setWebSearch);
  const addAttachments = useComposerStore((s) => s.addAttachment);
  const resetDraft = useComposerStore((s) => s.resetDraft);

  /* ---------- 4. useAskSession 回调：把 6 种事件写到 messages 对应 index ---------- */

  /** 当前 sendInternal 调用时的 aiMsg index（因为 send 内部会先调 onMessageReady，我们记住 index 在这里再写映射） */
  const pendingAiIdxRef = useRef<number | null>(null);

  const patchAssistantByBackendId = useCallback(
    (backendId: string, patch: Partial<ChatUIMessage>) => {
      const idx = msgIdIdxRef.current.get(backendId);
      if (idx === undefined) return;
      setMessages((prev) => {
        if (idx >= prev.length) return prev;
        const m = prev[idx];
        if (!m || m.role !== "assistant") return prev;
        // meta 增量合并（不覆盖已有字段）
        if (patch.meta && m.meta) {
          patch.meta = { ...m.meta, ...patch.meta };
        }
        const next = prev.slice();
        next[idx] = { ...m, ...patch };
        messagesRef.current = next;
        return next;
      });
    },
    [],
  );

  const cbsRef = useRef<AskStreamCallbacks>({
    // ⚠️ 时序修复：流式开始前第一时间写入 backendMsgId → aiIdx 映射
    onMessageReady: (backendId) => {
      const idx = pendingAiIdxRef.current;
      if (idx !== null && idx >= 0) {
        msgIdIdxRef.current.set(backendId, idx);
      }
    },
    onMeta: (id, d) => {
      const idx = msgIdIdxRef.current.get(id);
      const patchObj: Partial<ChatUIMessage> = {
        meta: {
          read_count: d.read_count,
          phase: (d.phase as "检索中" | "正在生成" | undefined) ?? undefined,
          context_truncated: d.context_truncated,
          warnings: (d as any).warning
            ? [...(((messagesRef.current[idx!]?.meta as any)?.warnings) ?? []), (d as any).warning]
            : undefined,
        } as any,
      };
      // Task 4 · R1：思考链增量 / 完整版
      if (typeof (d as any).thinkingContent === "string" && (d as any).thinkingContent) {
        patchObj.thinkingContent = (d as any).thinkingContent;
      } else if (typeof d.thinking_delta === "string") {
        // 用函数式 setMessages 做追加，避免 onMeta 乱序丢失 token
        setMessages((prev) => {
          if (idx === undefined || idx >= prev.length) return prev;
          const m = prev[idx];
          if (!m || m.role !== "assistant") return prev;
          const next = prev.slice();
          next[idx] = {
            ...m,
            thinkingContent: (m.thinkingContent ?? "") + d.thinking_delta!,
          };
          messagesRef.current = next;
          return next;
        });
      }
      // 基础 meta 增量走 patch
      patchAssistantByBackendId(id, patchObj);
    },
    onDelta: (id, text) => {
      const idx = msgIdIdxRef.current.get(id);
      if (idx === undefined) return;
      setMessages((prev) => {
        if (idx >= prev.length) return prev;
        const ai = prev[idx];
        if (!ai || ai.role !== "assistant") return prev;
        const next = prev.slice();
        next[idx] = { ...ai, content: ai.content + text };
        messagesRef.current = next;
        return next;
      });
    },
    onRefs: (id, sources) => {
      patchAssistantByBackendId(id, { sources });
    },
    onFollowups: (id, items) => {
      patchAssistantByBackendId(id, { followupItems: items });
    },
    onDone: (id, d) => {
      const idx = msgIdIdxRef.current.get(id);
      const prevMeta = (idx !== undefined && idx >= 0)
        ? messagesRef.current[idx]?.meta ?? {}
        : {};
      const prevThinking = (idx !== undefined && idx >= 0)
        ? messagesRef.current[idx]?.thinkingContent ?? undefined
        : undefined;
      // normalizeDoneStatus → ChatMessageStatus（"done" | "stopped" | "failed" | "streaming"）
      // → 映射为 B 内部 ChatSessionStatus（"idle" | "stopped" | "error" | "streaming"）
      let st: "idle" | "stopped" | "error" | "streaming" = "idle";
      if (d.status === "stopped") st = "stopped";
      else if (d.status === "failed") st = "error";
      else if (d.status === "streaming") st = "streaming";
      patchAssistantByBackendId(id, {
        status: st,
        thinkingContent: d.thinkingContent || prevThinking,
        meta: {
          ...prevMeta,
          duration_ms: d.duration_ms,
        },
      });
    },
    onError: (id, d) => {
      patchAssistantByBackendId(id, {
        status: "error",
        error: d.message,
        errorCode: String(d.code),
      });
    },
  });

  const session = useAskSession(() => cbsRef.current);
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  /* ---------- 5. 正在流式：最后一条助手消息是否还在生成中 ---------- */
  const isStreaming =
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    (messages[messages.length - 1].status === "streaming" ||
      messages[messages.length - 1].status === "sending");

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  /* ---------- 6. 内部发送（不带草稿，只负责写状态 + 调 session.send） ---------- */
  const sendInternal = useCallback(
    async (text: string, override?: { resumeLastMsgId?: string }) => {
      const q = text.trim();
      if (!q) return;
      if (isStreaming) return; // 上一条还在生成 → 忽略（Stop 按钮会中断）

      const userMsg: ChatUIMessage = {
        id: uid(),
        role: "user",
        content: q,
      };
      const aiMsg: ChatUIMessage = {
        id: uid(),
        role: "assistant",
        content: "",
        status: "streaming",
        meta: undefined,
      };

      const next = [...messagesRef.current, userMsg, aiMsg];
      setMessages(next);
      messagesRef.current = next;
      const aiIdx = next.length - 1;

      // ⚠️ 时序修复：在调用 send() 之前先写入 pendingAiIdxRef，
      // send() 内部会立即调用 onMessageReady(backendId) → 从 pendingAiIdxRef 读取 aiIdx 写映射，
      // 这样流式开始时 onMeta/onDelta 就能找到正确的 index（而不是等 send() return 之后才写）
      pendingAiIdxRef.current = aiIdx;

      // 构造历史（不含当前 assistant 占位）
      const history: ChatMessage[] = next
        .slice(0, -1)
        .map((m) => ({ role: m.role, content: m.content }));

      const backendId = await sessionRef.current.send({
        question: q,
        style: storeStyle,
        model: storeModel,
        webSearch: storeWebSearch,
        attachments: storeAttachments,
        history,
        webSearchFn: storeWebSearchFn ?? undefined,
        sessionId: sessionRef.current.getSessionId() ?? undefined,
      });

      // 兜底：再写一次映射（以防 onMessageReady 因竞态没触发；重复写 Map.set 无害）
      msgIdIdxRef.current.set(backendId, aiIdx);
      pendingAiIdxRef.current = null;
      // 把 backendMsgId 写进消息（resumeLast / stop 需要）
      patchAssistantByBackendId(backendId, { backendMsgId: backendId });

      resetDraft();
      // 草稿成功发送后清空 sessionStorage
      clearAskDraft();
    },
    [
      isStreaming,
      storeStyle,
      storeModel,
      storeWebSearch,
      storeAttachments,
      storeWebSearchFn,
      patchAssistantByBackendId,
      resetDraft,
    ],
  );

  /* ---------- 7. A 模块传参一次性应用：mode/model/webSearch + 草稿 attachments ---------- */
  const aParamsAppliedRef = useRef(false);
  useEffect(() => {
    if (aParamsAppliedRef.current) return;
    aParamsAppliedRef.current = true;

    // ① 草稿匹配：URL q 与草稿的 question 一致才使用
    const draft = readAskDraft(urlQ || null);
    const modeVal: ChatReplyModeLike | undefined =
      (draft?.mode as ChatReplyModeLike | undefined) ??
      (urlMode as ChatReplyModeLike | undefined) ??
      undefined;
    const styleB: ChatStyle = aModeToBStyle(
      asMode(modeVal as ChatReplyModeLike | null | undefined) as any,
    );

    // style 写入 store（B 的 store 存旧 ChatStyle 命名）
    setComposerStyle(styleB);

    // model：A 传 default 不强制覆盖（让 store 的默认模型保留用户习惯）；非 default 才写入
    const m = draft?.model ?? urlModel;
    if (m && m !== "default") setComposerModel(asModel(m));

    // web_search
    const ws = draft
      ? draft.web_search
      : urlWebSearch !== null
        ? asWebSearch(urlWebSearch)
        : undefined;
    if (ws !== undefined) setComposerWebSearch(ws);

    // attachments：草稿恢复到 composer store
    if (draft && draft.attachments && draft.attachments.length > 0) {
      const bAtts = toBAttachment(draft.attachments);
      for (const a of bAtts) addAttachments(a);
    }
  }, [
    urlQ,
    urlMode,
    urlModel,
    urlWebSearch,
    setComposerStyle,
    setComposerModel,
    setComposerWebSearch,
    addAttachments,
  ]);

  /* ---------- 8. 自动首问（A→B 跳转路径） ---------- */
  // ⚠️ 修复（2026.8.21 验收发现）：不能把 sendInternal 直接放进 effect 依赖 ——
  //   sendInternal 是 useCallback（依赖 isStreaming 等），流式开始后引用变化 → effect 重跑
  //   → cleanup 把 autoLaunchedRef 复位 → 再次自动发送，产生 N 组重复对话。
  //   方案：用 ref 持有最新 sendInternal（effect 只依赖 urlQ），cleanup 只清定时器、不复位标记。
  const sendInternalRef = useRef(sendInternal);
  sendInternalRef.current = sendInternal;
  const autoLaunchedQRef = useRef<string | null>(null);
  useEffect(() => {
    if (!urlQ || autoLaunchedQRef.current === urlQ) return;
    autoLaunchedQRef.current = urlQ;
    setComposerMessage(urlQ);
    const t = window.setTimeout(() => {
      sendInternalRef.current(urlQ);
    }, 50);
    return () => window.clearTimeout(t);
  }, [urlQ, setComposerMessage]);

  /* ---------- 9. 停止：中断流式 + 标记 status=stopped ---------- */
  const stopStreaming = useCallback(async () => {
    await sessionRef.current.stop();
    setMessages((prev) => {
      // 找到最后一条 status=streaming 的 assistant 并标记 stopped
      const next = prev.slice();
      for (let i = next.length - 1; i >= 0; i--) {
        if (
          next[i].role === "assistant" &&
          (next[i].status === "streaming" || next[i].status === "sending")
        ) {
          next[i] = { ...next[i], status: "stopped" };
          break;
        }
      }
      messagesRef.current = next;
      return next;
    });
  }, []);

  /* ---------- 10. 继续最近中断（后端 resume） ---------- */
  const resumeLast = useCallback(async () => {
    const lastId = sessionRef.current.getLastMessageId();
    if (!lastId) return;
    // UI 层把 status 重置为 streaming，让用户感知「恢复中」
    const idx = msgIdIdxRef.current.get(lastId);
    if (idx !== undefined) {
      setMessages((prev) => {
        const next = prev.slice();
        if (next[idx])
          next[idx] = {
            ...next[idx],
            status: "streaming",
            error: undefined,
            errorCode: undefined,
          };
        messagesRef.current = next;
        return next;
      });
    }
    const newId = await sessionRef.current.resumeLast();
    if (newId && idx !== undefined && newId !== lastId) {
      msgIdIdxRef.current.set(newId, idx);
      patchAssistantByBackendId(newId, { backendMsgId: newId });
    }
  }, [patchAssistantByBackendId]);

  /* ---------- 11. 重试：最近一条 user 消息重新发（删除尾部 assistant） ---------- */
  const retryLastUser = useCallback(() => {
    const userMsgs = messagesRef.current.filter((m) => m.role === "user");
    if (userMsgs.length === 0) return;
    const lastUser = userMsgs[userMsgs.length - 1];
    setMessages((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0 || prev[lastIdx].role !== "assistant") return prev;
      const next = prev.slice(0, lastIdx);
      messagesRef.current = next;
      return next;
    });
    window.setTimeout(() => sendInternal(lastUser.content), 0);
  }, [sendInternal]);

  /* ---------- 12. 新对话 ---------- */
  const newChat = useCallback(async () => {
    await sessionRef.current.stop();
    sessionRef.current.reset();
    msgIdIdxRef.current.clear();
    setMessages([]);
    messagesRef.current = [];
    setActiveConv(null);
    setComposerMessage("");
  }, [setComposerMessage]);

  /* ---------- 13. Composer 实例 ---------- */
  const composer = (
    <ComposerShell
      value={composerMessage}
      onChange={setComposerMessage}
      placeholder="继续提问,或上传 PDF / arXiv 链接以扩展上下文…"
      replyMode={mapToAMode(storeStyle)}
      onReplyModeChange={(m) => setComposerStyle(mapToBStyle(m))}
      model={storeModel as any}
      onModelChange={(m) => setComposerModel(m)}
      webSearch={storeWebSearch}
      onWebSearchChange={setComposerWebSearch}
      attachments={storeAttachments as any}
      onAttachmentsChange={(items) => {
        // ComposerShell 内用 A 格式 ChatAttachment（types/ai-search），
        // store 接受 B 旧格式，先 toBAttachment 再批量写入
        useComposerStore.getState().clearAttachments();
        const bAtts = toBAttachment(items as any);
        for (const a of bAtts) useComposerStore.getState().addAttachment(a);
      }}
      busy={isStreaming}
      onStop={stopStreaming}
      onSend={(payload) => {
        // 先把用户从 ComposerShell 里改过的 style/model 回写到 store（sendInternal 从 store 读）
        if (payload.mode) setComposerStyle(mapToBStyle(payload.mode));
        if (payload.model) setComposerModel(payload.model);
        if (typeof payload.web_search === "boolean") setComposerWebSearch(payload.web_search);
        if (payload.attachments && payload.attachments.length > 0) {
          useComposerStore.getState().clearAttachments();
          const bAtts = toBAttachment(payload.attachments as any);
          for (const a of bAtts) useComposerStore.getState().addAttachment(a);
        }
        sendInternal(payload.question);
      }}
      menuPlacement="up"
    />
  );

  /* ---------- 14. 左侧历史栏 ---------- */
  const historyPanel = (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-line bg-sidebar p-3">
      <button
        type="button"
        onClick={newChat}
        className="flex h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-xl bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
      >
        <MessageSquarePlus className="size-4" strokeWidth={1.8} />
        新对话
      </button>
      <p className="shrink-0 px-3 pb-1.5 pt-4 text-[11px] font-medium tracking-wide text-faint">
        历史对话
      </p>
      <div className="scrollbar-subtle flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {HISTORY.map((title) => (
          <button
            key={title}
            type="button"
            aria-current={activeConv === title ? "page" : undefined}
            onClick={() => setActiveConv(title)}
            className={cn(
              "flex h-9 shrink-0 cursor-pointer items-center rounded-lg px-3 text-left text-sm transition-colors",
              activeConv === title
                ? "bg-card font-medium text-primary shadow-sm"
                : "text-muted hover:bg-card hover:text-ink-2",
            )}
          >
            <span className="truncate">{title}</span>
          </button>
        ))}
      </div>
    </aside>
  );

  /* ---------- 15. 空状态 ---------- */
  if (messages.length === 0) {
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
          <div className="w-full max-w-4xl">{composer}</div>
          <div className="flex max-w-4xl flex-wrap items-center justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => sendInternal(s)}
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

  /* ---------- 16. 对话流 ---------- */
  return (
    <CWebSearchProvider>
      <div className="flex">
        {historyPanel}
      <div className="flex h-screen min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
            {messages.map((msg, i) => {
              if (msg.role === "user") {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <p className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-white">
                      {msg.content}
                    </p>
                  </div>
                );
              }
              const loading =
                (msg.status === "streaming" && !msg.content) ||
                msg.status === "sending";
              return (
                <div key={msg.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                    <Sparkles className="size-4 text-primary" />
                  </span>
                  {/* 🔗 引用双向联动作用域：每条助手消息单独一个 CitationProvider
                        保证正文 [n] ↔ ReferenceGrid 卡片的 activeCitation 互不干擾 */}
                  <CitationProvider>
                  <div className="max-w-[80%] space-y-3">
                    {/* 思考面板（流式中 / 有 meta 信息都展示） */}
                    {(msg.meta || msg.status === "streaming") && (
                      <ThinkingPanel
                        phase={msg.meta?.phase as "检索中" | "正在生成" | "warning" | undefined}
                        readCount={msg.meta?.read_count}
                        durationMs={msg.meta?.duration_ms}
                        truncated={msg.meta?.context_truncated}
                        warnings={
                          // Task 3：附件截断告警有两种形态：
                          //   - 单条：meta.warning（chat-stream.ts 里 onMeta 注入时）
                          //   - 多条：meta.warnings（onMeta 聚合时 push 进数组）
                          ([
                            ...(((msg.meta as any)?.warnings as any[]) ?? []),
                            ...((msg.meta as any)?.warning
                              ? [(msg.meta as any).warning]
                              : []),
                          ] as any[]).filter(Boolean) as any
                        }
                      />
                    )}

                    {/* Task 4 · R1：深度思考折叠面板（有思考链才渲染） */}
                    {msg.thinkingContent && (
                      <ReasoningChainPanel content={msg.thinkingContent} streaming={msg.status === "streaming"} />
                    )}

                    {/* 错误：显示 ErrorBubble */}
                    {msg.status === "error" ? (
                      <ErrorBubble
                        code={msg.errorCode ?? "REQUEST_FAILED"}
                        message={msg.error ?? "请求失败"}
                        onRetry={retryLastUser}
                        onResume={resumeLast}
                        canResume={msg.errorCode === "20004"}
                      />
                    ) : (
                      <div className="rounded-2xl rounded-tl-md bg-card px-4 py-2.5 text-sm leading-relaxed text-ink shadow-card whitespace-pre-wrap break-words">
                        {/* 旧：直接纯文本渲染 {msg.content} */}
                        {/* 新：CitationContent 把 [n] 转成可点击按钮，联动 ReferenceGrid */}
                        {msg.content ? (
                          <CitationContent text={msg.content} />
                        ) : (
                          loading ? <TypingDots /> : "\u00A0"
                        )}
                        {msg.status === "streaming" && msg.content && (
                          <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-ink-2 align-[-2px]" />
                        )}
                      </div>
                    )}

                    {/* stopped 状态 + 继续 / 重试 */}
                    {msg.status === "stopped" && (
                      <div className="flex items-center gap-2 text-[12px] text-muted">
                        <span>已停止生成（内容仅为部分回复）</span>
                        <button
                          type="button"
                          onClick={resumeLast}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-chip px-2 py-1 text-[11px] text-ink-2 hover:bg-chip/70"
                        >
                          <Play className="size-3" />
                          继续
                        </button>
                        <button
                          type="button"
                          onClick={retryLastUser}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-chip px-2 py-1 text-[11px] text-ink-2 hover:bg-chip/70"
                        >
                          <RefreshCw className="size-3" />
                          重试
                        </button>
                      </div>
                    )}

                    {/* 引用卡片（C3：用 ReferenceGrid 替换内联 SourcesSection） */}
                    {msg.sources && msg.sources.length > 0 && (
                      <ReferenceGrid sources={msg.sources} limit={4} />
                    )}

                    {/* 追问建议 */}
                    {msg.followupItems && msg.followupItems.length > 0 && (
                      <FollowUpsBar
                        items={msg.followupItems}
                        onPick={(q) => {
                          setComposerMessage(q);
                          sendInternal(q);
                        }}
                      />
                    )}
                  </div>
                  </CitationProvider>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>
        <div className="px-6 pb-5">
          <div className="mx-auto max-w-5xl">{composer}</div>
        </div>
      </div>
    </div>
    </CWebSearchProvider>
  );
}

/* =========================================================
 *  小工具：A 协议 ChatReplyMode ↔ B 层 ChatStyle 互转（这里放一份局部函数）
 *  注：lib/api/search.ts 也有 mapToAMode / mapToBStyle，这里做 UI 读取用
 * ======================================================= */

type ChatReplyModeLike = "fast" | "deep" | "idea" | "doubt" | (string & {});

function aModeToBStyle(m: ChatReplyModeLike): ChatStyle {
  switch (m) {
    case "idea":
      return "inspire";
    case "doubt":
      return "question";
    case "deep":
      return "deep";
    case "fast":
      return "fast";
    default:
      return "fast";
  }
}
