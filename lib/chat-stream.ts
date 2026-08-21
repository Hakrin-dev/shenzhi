/**
 * B 模块 —— 统一 AI 对话流式 Hook（基于 A 协议 6 种 SSE 事件）。
 *
 * 【与旧版 useChatStream 的差异】
 *  旧版：内部直接打 /api/ai/chat + ChatStreamEventType（token/sources/done/error）
 *  新版：调用 lib/api/search.ts 的「两步法」API：
 *    1. createChatSession() → 获得 session_id + first_message_id
 *    2. streamChatMessage(message_id, { onMeta/onDelta/onRefs/onFollowups/onDone/onError })
 *
 *  这样当 AI_BACKEND_MODE="A" 时，直接联通 A 的后端；
 *  "B" 时由 lib/api/search.ts 内部做协议翻译（旧 token/sources → 新 meta/delta/refs）。
 *
 * 【对外导出】
 *  useAskSession()：会话级句柄（send/stop/resumeLast/reset）+ 会话/消息 ID。
 *  这是 agent-chat.tsx 唯一需要依赖的入口。
 */

import { useCallback, useEffect, useRef } from "react";
import {
  buildCreateSessionRequest,
  createChatSession,
  resumeChatMessage,
  sourceTypeTone,
  stopChatMessage,
  streamChatMessage,
  mapToAMode,
  normalizePhase,
  type StreamChatMessageHandlers,
} from "@/lib/api/search";
import { buildModelMessages } from "@/lib/chat-prompt";
import type {
  ChatAttachment,
  ChatMessage,
  ChatSource,
  ChatStyle,
  ChatUIMessage,
} from "@/types";
import type {
  AIEventDone,
  AIEventError,
  AIEventFollowups,
  AIEventMeta,
  AIEventRefs,
  ChatMessageStatus,
  ChatReference,
  StreamDeltaEvent,
  StreamDoneEvent,
  StreamErrorEvent,
  StreamFollowupsEvent,
  StreamMetaEvent,
  StreamRefsEvent,
} from "@/types/ai-search";

/* ---------------- 对外暴露的回调接口（UI 层消费 6 种事件） ---------------- */

export interface AskStreamCallbacks {
  /**
   * ⚠️ 最早触发的回调：拿到 backendMsgId 后、流式开始前立即触发。
   * UI 层必须在这里写入 msgIdIdxRef，否则后续 onMeta/onDelta/... 会找不到 idx。
   * （修复时序 bug：原写在 await send() 返回后 → 流内首 token 已触发过 patch 了，映射缺失）
   */
  onMessageReady?: (backendMsgId: string) => void;
  /** meta 事件：read_count / phase / context_truncated */
  onMeta: (messageId: string, data: AIEventMeta) => void;
  /** delta 事件：正文增量 */
  onDelta: (messageId: string, text: string) => void;
  /** refs 事件：引用列表（已转旧 ChatSource[]，便于 UI 渲染） */
  onRefs: (messageId: string, sources: ChatSource[]) => void;
  /** followups 事件：追问建议 chips */
  onFollowups: (messageId: string, items: string[]) => void;
  /** done 事件：{ duration_ms, status } */
  onDone: (messageId: string, data: AIEventDone) => void;
  /** error 事件：{ code, message } */
  onError: (messageId: string, data: AIEventError) => void;
}

/* ---------------- 发送参数 ---------------- */

export interface SendOptions {
  question: string;
  /** B 层 style 命名（inspire/question），内部会 mapToAMode 转换 */
  style: ChatStyle;
  model: string;
  webSearch: boolean;
  attachments: ChatAttachment[];
  /** 多轮对话历史（不含当前这条 question 的 user turn） */
  history: ChatMessage[];
  /** C 模块注入的联网搜索前置函数 */
  webSearchFn?: (query: string) => Promise<ChatSource[]>;
  /** 会话 id：首条发送为空（会 create 新会话），续问时传已有 id */
  sessionId?: string;
}

/* ---------------- 返回句柄 ---------------- */

export interface AskSessionHandle {
  /** 发送（首次 or 续问），返回该条助手消息的 messageId（backendMsgId） */
  send: (opts: SendOptions) => Promise<string>;
  /** 中断当前正在生成的那条消息（Stop 按钮） */
  stop: () => Promise<void>;
  /**
   * 继续最近失败 / 中断的那条：
   *   - 先调后端 resumeChatMessage(lastMsgId) → 获得新 message_id
   *   - 再调 streamChatMessage 继续拉流
   * 如果当前模式为 B（/api/ai/chat 原型），直接用原 message_id 重新 stream。
   */
  resumeLast: () => Promise<string | null>;
  /** 重置：清空会话 id、lastMsgId */
  reset: () => void;
  /** 获取当前会话 id（用于 debug） */
  getSessionId: () => string | null;
  /** 获取最近一条消息 id（用于 resumeLast） */
  getLastMessageId: () => string | null;
}

/** 60s 无 delta → 超时（网络差或模型挂死） */
const TOKEN_TIMEOUT_MS = 60_000;

/**
 * 主 Hook。入参为 getter（返回稳定 callbacks），避免 React Compiler complain。
 * 用法：
 *   const cbsRef = useRef(...);
 *   const session = useAskSession(() => cbsRef.current);
 */
export function useAskSession(getCbs: () => AskStreamCallbacks): AskSessionHandle {
  const getCbsRef = useRef(getCbs);
  useEffect(() => {
    getCbsRef.current = getCbs;
  }, [getCbs]);

  const sessionIdRef = useRef<string | null>(null);
  const lastMsgIdRef = useRef<string | null>(null);
  /** 当前流式 AbortController（stop 用） */
  const aborterRef = useRef<AbortController | null>(null);
  /** 上次 send 的 options 快照（retry 可能用，当前 resumeLast 直接走后端 resume 接口） */
  const lastSendOptsRef = useRef<SendOptions | null>(null);

  const reset = useCallback(() => {
    aborterRef.current?.abort();
    aborterRef.current = null;
    sessionIdRef.current = null;
    lastMsgIdRef.current = null;
  }, []);

  const stop = useCallback(async () => {
    const aborter = aborterRef.current;
    const msgId = lastMsgIdRef.current;
    aborter?.abort();
    aborterRef.current = null;
    if (msgId) {
      try {
        await stopChatMessage(msgId);
      } catch {
        /* 网络断开时忽略 stop 请求失败（已通过 AbortController 本地中断） */
      }
    }
  }, []);

  /* --- 核心：发送 --- */
  const send = useCallback(
    async (opts: SendOptions): Promise<string> => {
      lastSendOptsRef.current = opts;
      const cbs = () => getCbsRef.current();

      // 0. 前一轮还在流 → 先中止
      if (aborterRef.current) {
        aborterRef.current.abort();
        aborterRef.current = null;
      }
      const aborter = new AbortController();
      aborterRef.current = aborter;

      // 1. 前置联网搜索（C 模块提供 webSearchFn 时触发）
      let webSearchSources: ChatSource[] = [];
      if (opts.webSearch && opts.webSearchFn) {
        try {
          webSearchSources = await opts.webSearchFn(opts.question);
        } catch (e) {
          console.warn("[B] webSearchFn failed:", e);
        }
        if (aborter.signal.aborted) {
          return "";
        }
      }

      // 2. 把 B 层 ChatStyle → A 层 ChatReplyMode（inspire→idea / question→doubt）
      const reqA = buildCreateSessionRequest({
        question: opts.question,
        mode: mapToAMode(opts.style),
        model: opts.model ?? "default",
        webSearch: opts.webSearch,
        attachments: opts.attachments,
      });

      // 3. 构造 messages（含 system + 历史，给后端 buildModelMessages 用或模式 B 直接透传）
      //    attachmentWarnings：3万/6万字硬截断告警 → 下面流式前就注入思考面板 meta warning
      const { messages: builtMessages, attachmentWarnings } = buildModelMessages({
        style: opts.style,
        history: opts.history,
        attachments: opts.attachments,
        webSearchSources,
      });

      // 4. 两步法：createChatSession（没有 sessionId 时才创建）
      let backendMsgId: string;
      try {
        if (!opts.sessionId) {
          const session = await createChatSession(reqA);
          sessionIdRef.current = session.id;
          backendMsgId = session.first_message_id;
        } else {
          sessionIdRef.current = opts.sessionId;
          // 续问：走 sendChatMessage 再发一条（模式 A 后端使用；模式 B 直接本地生成 msgId）
          const resp = await (async () => {
            // 动态 import 避免顶级循环依赖
            const { sendChatMessage: fn } = await import("@/lib/api/search");
            const sid = opts.sessionId!; // else 分支已保证 opts.sessionId 存在
            return fn(sid, {
              question: opts.question,
              mode: mapToAMode(opts.style),
              model: opts.model ?? "default",
              web_search: opts.webSearch,
              attachments: (await import("@/lib/ask/draft")).toAAttachment(opts.attachments),
            });
          })();
          backendMsgId = resp.message_id;
        }
      } catch (e) {
        const msg = (e as Error)?.message || "创建会话失败";
        const code =
          (e as { code?: string })?.code ?? "REQUEST_FAILED";
        // 创建阶段没有 backendMsgId，用一个临时 id 让 error UI 还能定位气泡
        const fallbackId = `tmp_${Date.now().toString(36)}`;
        lastMsgIdRef.current = fallbackId;
        cbs().onError(fallbackId, { code, message: msg });
        aborterRef.current = null;
        return fallbackId;
      }

      lastMsgIdRef.current = backendMsgId;
      if (aborter.signal.aborted) return backendMsgId;

      // ⚠️ 时序修复：流式开始前就通知 UI 层 backendMsgId 已就绪，立即写映射，
      // 否则后续 onMeta/onDelta 触发时 msgIdIdxRef 里还没有 backendMsgId → aiIdx 映射
      cbs().onMessageReady?.(backendMsgId);

      // C2 前置联网：搜索结果立即回传 UI（来源卡片先于 AI 正文渲染，msg.sources 非空）
      // 模式 B（本地 DeepSeek）后端不会发 refs 事件，此调用不会被覆盖；若未来后端也发 refs，
      // 以 onRefs handler 的后续覆盖为准（联网结果仍拼在 system prompt，不影响 AI 回答）。
      if (webSearchSources.length > 0) {
        cbs().onRefs(backendMsgId, webSearchSources);
      }
      // ✨ 思考面板告警（第二阶段 P1 附件截断）：如果 buildAttachmentContext 返回了
      // ATTACHMENT_TRUNCATED_30K / ATTACHMENT_OVERALL_TRUNCATED_60K → 作为 meta 事件
      // 注入 phase="warning" + context_truncated=true，思考面板 step 会展示 ⚠️ 红标
      if (attachmentWarnings.length > 0) {
        for (const w of attachmentWarnings) {
          cbs().onMeta(backendMsgId, {
            phase: "warning" as any,
            read_count: undefined as any,
            context_truncated: true,
            warning: w,
          } as any);
        }
      }

      // 5. streamChatMessage 拉 SSE
      //    ⚠️ 修复：超时定时器必须在调用流式之前设置（原顺序反了，导致流式中 onDelta 清不到 timer，60s 超时也不生效）
      let tokenTimer: ReturnType<typeof setTimeout> | null = null;
      let gotAnyDelta = false;
      let finished = false;
      const fullTextRef = { current: "" };

      // 超时保护：流式开始前就挂 60s 定时器
      const clearTokenTimer = () => {
        if (tokenTimer) {
          clearTimeout(tokenTimer);
          tokenTimer = null;
        }
      };
      tokenTimer = setTimeout(() => {
        if (!finished && !gotAnyDelta && !aborter.signal.aborted) {
          aborter.abort();
          cbs().onError(backendMsgId, {
            code: "TIMEOUT",
            message:
              "AI 响应超时（60s 未收到首 token），请检查网络或模型服务状态。",
          });
        }
      }, TOKEN_TIMEOUT_MS);

      try {
        const h: StreamChatMessageHandlers = {
          onMeta: (d: StreamMetaEvent) =>
            cbs().onMeta(backendMsgId, {
              ...d,
              phase: normalizePhase(d.phase) as any,
            }),
          onDelta: (d: StreamDeltaEvent) => {
            gotAnyDelta = true;
            clearTokenTimer(); // 首 token 到 → 取消超时
            fullTextRef.current += d.text;
            cbs().onDelta(backendMsgId, d.text);
          },
          onRefs: (d: StreamRefsEvent) => {
            const srcs = chatRefsToChatSources(d.references);
            cbs().onRefs(backendMsgId, srcs);
          },
          onFollowups: (d: StreamFollowupsEvent) =>
            cbs().onFollowups(backendMsgId, d.items),
          onDone: (d: StreamDoneEvent) => {
            clearTokenTimer();
            cbs().onDone(backendMsgId, {
              duration_ms: d.duration_ms,
              status: normalizeDoneStatus(d.status as any),
              thinkingContent: d.thinkingContent,
            });
          },
          onError: (d: StreamErrorEvent) => {
            clearTokenTimer();
            cbs().onError(backendMsgId, {
              code: String(d.code),
              message: d.message,
            });
          },
        };
        await streamChatMessage(
          backendMsgId,
          h,
          // 模式 B 时传递请求上下文（模式 A 忽略）
          {
            request: reqA,
            messages: builtMessages,
            webSearchSources,
          },
          { signal: aborter.signal },
        );
      } catch (err) {
        if (aborter.signal.aborted) return backendMsgId;
        const code = (err as { code?: string })?.code;
        const name = (err as { name?: string })?.name;
        const msg = (err as Error).message || "流式请求失败";
        clearTokenTimer();
        if (
          name === "NgrokInterceptError" ||
          code === "NGROK_INTERCEPT" ||
          code === "NGROK_403"
        ) {
          cbs().onError(backendMsgId, { code: code ?? "NGROK_INTERCEPT", message: msg });
        } else {
          cbs().onError(backendMsgId, { code: code ?? "REQUEST_FAILED", message: msg });
        }
      } finally {
        finished = true;
        clearTokenTimer();
        if (aborterRef.current === aborter) aborterRef.current = null;
      }

      return backendMsgId;
    },
    [],
  );

  /* --- 继续最近失败的那条 --- */
  const resumeLast = useCallback(async (): Promise<string | null> => {
    const lastId = lastMsgIdRef.current;
    if (!lastId) return null;
    if (aborterRef.current) {
      aborterRef.current.abort();
      aborterRef.current = null;
    }
    const aborter = new AbortController();
    aborterRef.current = aborter;

    try {
      const { message_id: newId } = await resumeChatMessage(lastId);
      lastMsgIdRef.current = newId;
      const cbs = () => getCbsRef.current();

      // 继续拉流 —— 重新注册全部 6 种 handler（规范化 phase/status/code）
      const rh: StreamChatMessageHandlers = {
        onMeta: (d: StreamMetaEvent) =>
          cbs().onMeta(newId, {
            ...d,
            phase: normalizePhase(d.phase) as any,
          }),
        onDelta: (d: StreamDeltaEvent) => cbs().onDelta(newId, d.text),
        onRefs: (d: StreamRefsEvent) =>
          cbs().onRefs(newId, chatRefsToChatSources(d.references)),
        onFollowups: (d: StreamFollowupsEvent) => cbs().onFollowups(newId, d.items),
        onDone: (d: StreamDoneEvent) =>
          cbs().onDone(newId, {
            duration_ms: d.duration_ms,
            status: normalizeDoneStatus(d.status as any),
            thinkingContent: d.thinkingContent,
          }),
        onError: (d: StreamErrorEvent) =>
          cbs().onError(newId, {
            code: String(d.code),
            message: d.message,
          }),
      };
      await streamChatMessage(newId, rh, undefined, { signal: aborter.signal });
      return newId;
    } catch (e) {
      if (aborter.signal.aborted) return null;
      const code = (e as { code?: string })?.code ?? "REQUEST_FAILED";
      const msg = (e as Error).message || "恢复生成失败";
      getCbsRef.current().onError(lastId, { code, message: msg });
      return null;
    } finally {
      if (aborterRef.current === aborter) aborterRef.current = null;
    }
  }, []);

  return {
    send,
    stop,
    resumeLast,
    reset,
    getSessionId: () => sessionIdRef.current,
    getLastMessageId: () => lastMsgIdRef.current,
  };
}

/* ---------------- 工具：A 的 ChatReference[] → B 渲染用 ChatSource[] ---------------- */

export function chatRefsToChatSources(refs: ChatReference[]): ChatSource[] {
  return refs.map((r) => ({
    id: r.ordinal,
    title: r.title,
    venue: r.venue ?? undefined,
    author: r.authors,
    citations:
      typeof r.citation_count === "number"
        ? r.citation_count > 0
          ? `引用 ${r.citation_count}`
          : undefined
        : undefined,
    url: r.url ?? undefined,
    tone: r.recommended ? "amber" : sourceTypeTone(r.source_type),
    recommended: r.recommended,
    type: r.source_type,
  }));
}

/**
 * 规范化 done.status：
 *   A 后端可能传 "completed" / "interrupted"
 *   B 模块内部 ChatMessageStatus 使用 "done" / "stopped" / "failed" / "streaming"
 */
export function normalizeDoneStatus(
  s: AIEventDone["status"],
): ChatMessageStatus {
  if (!s) return "done";
  switch (s as string) {
    case "completed":
    case "done":
      return "done";
    case "stopped":
    case "interrupted":
      return "stopped";
    case "failed":
    case "error":
      return "failed";
    case "streaming":
    case "sending":
      return "streaming";
    default:
      // 兜底：已经是中文 / 未知字符串 → 默认归为 done
      return "done";
  }
}

/** 辅助类型：让 agent-chat.tsx 从 lib/chat-stream 就能取到类型 */
export type { ChatUIMessage };
