/**
 * A 模块标准 AI 搜索 API 封装（B 模块兼容版本）。
 *
 * 【两种后端模式】
 *
 *  模式 A（真实 A 后端）：
 *    请求走到同源 /api/v1 代理（app/api/v1/[...path]/route.ts → ${API_URL}/api/v1/...）
 *    - createChatSession → POST /api/v1/search/sessions
 *    - sendChatMessage  → POST /api/v1/search/sessions/{id}/messages
 *    - streamChatMessage → GET  /api/v1/search/messages/{id}/stream（SSE）
 *    - stopChatMessage   → POST /api/v1/search/messages/{id}/stop
 *    - resumeChatMessage → POST /api/v1/search/messages/{id}/resume
 *
 *  模式 B（B 原型后端 / ngrok 联调）：
 *    直接 POST /api/ai/chat，响应为 SSE 流（ChatStreamEventType 旧协议）。
 *    由环境变量 NEXT_PUBLIC_AI_BACKEND_MODE = "A" | "B" 控制，默认 "B"（向后兼容）。
 *    这种情况下以上 5 个 API 会在前端做适配模拟：
 *    createChatSession() 内部会生成一个本地 session_id，streamChatMessage() 内部直接打 /api/ai/chat。
 *
 * B 模块开发时，在 .env.local 中切换：
 *   NEXT_PUBLIC_AI_BACKEND_MODE=A  # 联调 A 后端
 *   NEXT_PUBLIC_AI_BACKEND_MODE=B  # 本地原型（默认）
 */

import { shenzhiFetch } from "@/lib/request";
import { readSSEStream } from "@/lib/sse";
import type {
  ChatSession,
  CreateChatSessionRequest,
  CreateChatSessionResponse,
  SearchConfig,
  SendChatMessageRequest,
  StreamDeltaEvent,
  StreamDoneEvent,
  StreamErrorEvent,
  StreamFollowupsEvent,
  StreamMetaEvent,
  StreamRefsEvent,
} from "@/types/ai-search";
import type {
  ChatAttachment as BChatAttachment,
  ChatSource,
  ChatStreamEvent,
  ChatUIMessage,
} from "@/types";
import { toAAttachment } from "@/lib/ask/draft";

/** 后端模式：默认 "B"，保持 B 模块现有行为不被破坏 */
export const AI_BACKEND_MODE: "A" | "B" =
  (process.env.NEXT_PUBLIC_AI_BACKEND_MODE as "A" | "B" | undefined) === "A"
    ? "A"
    : "B";

const V1_PREFIX = "/api/v1";

/* =========================================================================
 *  0. 通用工具：phase 中英文映射 + FALLBACK 配置
 * ======================================================================= */

/** A 模块标准 SearchConfig 兜底（当后端 /search/config 不可达时使用） */
export const FALLBACK_SEARCH_CONFIG: SearchConfig = {
  models: [
    { value: "default", label: "默认", enabled: true },
    {
      value: "subscription",
      label: "订阅",
      enabled: false,
      reason: "not_subscribed",
    },
    { value: "byok", label: "API接入", enabled: false, reason: "no_api_key" },
  ],
  modes: ["fast", "deep", "idea", "doubt"],
  quota: { used: 0, limit: 20, deep_used: 0, deep_limit: 5 },
  upload: {
    max_size_mb: 20,
    max_files: 5,
    accept: [".pdf", ".docx", ".md", ".txt"],
  },
};

/**
 * phase 映射：A 后端可能传英文（"generating" 等），B 前端 UI 统一展示中文。
 *   "generating"              → "正在生成"
 *   "retrieving" / "searching" → "检索中"
 *   其他（含已中文的）         → 原词透传
 */
export function normalizePhase(
  phase: string | undefined | null,
): "检索中" | "正在生成" | undefined {
  if (!phase) return undefined;
  const p = String(phase).trim().toLowerCase();
  if (p === "generating" || p.includes("生成")) return "正在生成";
  if (
    p === "retrieving" ||
    p === "searching" ||
    p.includes("检索") ||
    p.includes("搜索") ||
    p.includes("阅读")
  )
    return "检索中";
  // 兜底：如果已是中文则原词返回；否则默认归为「检索中」
  if (/[\u4e00-\u9fa5]/.test(String(phase))) return String(phase) as any;
  return "检索中";
}

/* =========================================================================
 *  1. 公共类型
 * ======================================================================= */

export interface StreamChatMessageHandlers {
  onMeta?: (data: StreamMetaEvent) => void;
  onDelta?: (data: StreamDeltaEvent) => void;
  onRefs?: (data: StreamRefsEvent) => void;
  onFollowups?: (data: StreamFollowupsEvent) => void;
  onDone?: (data: StreamDoneEvent) => void;
  onError?: (data: StreamErrorEvent) => void;
}

export interface StreamOptions {
  signal?: AbortSignal;
  lastEventId?: string;
  /** 可选：附加 Authorization 等请求头 */
  headers?: Record<string, string>;
}

/* =========================================================================
 *  2. 模式 B（B 原型后端）的本地适配工具
 *  —— 目的：在 A 后端未就绪时，让 B 模块 UI 仍按「两步法」跑通
 * ======================================================================= */

/** 模式 B 下，用于把 ChatReference[] 转成旧 ChatSource[]（供旧 SSE sources 事件使用） */
function oldSourcesFromRefs(
  refs: StreamRefsEvent["references"] | undefined,
): ChatSource[] | undefined {
  if (!refs) return undefined;
  return refs.map((r) => ({
    id: r.ordinal,
    title: r.title,
    venue: r.venue ?? undefined,
    author: r.authors,
    citations: `引用 ${r.citation_count}`,
    url: r.url ?? undefined,
    tone: r.recommended ? "amber" : sourceTypeTone(r.source_type),
    recommended: r.recommended,
    type: r.source_type,
  }));
}

/** source_type → tone 配色（对齐 A 模块引用卡片配色） */
export function sourceTypeTone(
  t: string,
): "violet" | "green" | "amber" | "gray" {
  switch (t) {
    case "paper":
    case "scholar":
      return "violet";
    case "patent":
    case "funding":
      return "green";
    case "institution":
      return "amber";
    case "web":
    default:
      return "gray";
  }
}

/* =========================================================================
 *  3. 5 个对外 API（模式 A / B 行为在函数内部分支）
 *    注意：
 *    - createChatSession / sendChatMessage 同时返回 ChatSession（旧B） + CreateChatSessionResponse（A）
 *      即：{ id, type, first_message_id, created_at, session_id, message_id }
 *      这样无论消费方按哪种字段读都能命中。
 * ======================================================================= */

/** 把 A 的 CreateChatSessionResponse 合成「双字段兼容对象」 */
function compatSession(
  a: CreateChatSessionResponse,
  type: CreateChatSessionRequest["type"] = "chat",
): ChatSession & CreateChatSessionResponse {
  return {
    id: a.session_id,
    type,
    first_message_id: a.message_id,
    created_at: new Date().toISOString(),
    session_id: a.session_id,
    message_id: a.message_id,
  };
}

/**
 * 创建会话。返回 session + first_message_id（同时兼容 A/B 两种命名）。
 * 模式 B：在前端内存中生成假 session，不调用网络。
 */
export async function createChatSession(
  req: CreateChatSessionRequest,
  init?: RequestInit,
): Promise<ChatSession & CreateChatSessionResponse> {
  if (AI_BACKEND_MODE === "A") {
    const resp = await shenzhiFetch<CreateChatSessionResponse>(
      `${V1_PREFIX}/search/sessions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        ...init,
      },
    );
    return compatSession(resp, req.type);
  }
  // 模式 B：前端生成临时 session_id / message_id，不发起真实请求
  const sessionId = `bs_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const firstMsgId = `bm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return compatSession(
    { session_id: sessionId, message_id: firstMsgId },
    req.type,
  );
}

/**
 * 发送消息（续问）。
 * 请求体：SendChatMessageRequest = { question, mode?, model?, web_search?, attachments? }
 * 返回：{ session_id, message_id }（同时含 id/first_message_id 兼容）
 */
export async function sendChatMessage(
  sessionId: string,
  body: SendChatMessageRequest,
  init?: RequestInit,
): Promise<ChatSession & CreateChatSessionResponse> {
  if (AI_BACKEND_MODE === "A") {
    const resp = await shenzhiFetch<CreateChatSessionResponse>(
      `${V1_PREFIX}/search/sessions/${sessionId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        ...init,
      },
    );
    return compatSession(resp, "chat");
  }
  const msgId = `bm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return compatSession({ session_id: sessionId, message_id: msgId }, "chat");
}

/**
 * 核心：拉取 SSE 流。
 *  - 模式 A：GET /api/v1/search/messages/{id}/stream
 *  - 模式 B：POST /api/ai/chat，解析旧协议的 {type: "sources" | "token" | "done" | "error"}，
 *            在前端翻译成 A 协议的 meta / delta / refs / done / error 6 种事件。
 *            这样 AgentChat UI 只需要实现一套事件处理。
 */
export async function streamChatMessage(
  /** 模式 A：服务端返回的 message_id；模式 B：可以随意传字符串 */
  messageId: string,
  handlers: StreamChatMessageHandlers,
  /**
   * 模式 B 必须提供完整请求信息（因为 POST /api/ai/chat 需要 ChatRequest）。
   * 模式 A 忽略此参数（消息已通过 sendChatMessage 提交）。
   */
  modeBPayload?: {
    request: CreateChatSessionRequest;
    /** 多轮对话历史（模式 B 的 /api/ai/chat 需要 messages 数组） */
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    /** C 模块前置联网搜索返回的 sources（可选） */
    webSearchSources?: ChatSource[];
  },
  options: StreamOptions = {},
): Promise<void> {
  if (AI_BACKEND_MODE === "A") {
    return streamA(messageId, handlers, options);
  }
  return streamB(messageId, handlers, options, modeBPayload);
}

/* --- 模式 A：真实拉 A 后端 SSE --- */
async function streamA(
  messageId: string,
  handlers: StreamChatMessageHandlers,
  options: StreamOptions,
) {
  await readSSEStream(`${V1_PREFIX}/search/messages/${messageId}/stream`, {
    signal: options.signal,
    lastEventId: options.lastEventId,
    headers: options.headers,
    onEvent: (event, data) => {
      handleAEvent(event, data, handlers);
    },
  });
}

/** 解析 A 协议 6 种事件名并分发到对应 handler（内部自动 phase 规范化） */
export function handleAEvent(
  eventName: string,
  dataStr: string,
  handlers: StreamChatMessageHandlers,
) {
  if (!dataStr) return;
  switch (eventName) {
    case "meta": {
      let d: StreamMetaEvent;
      try {
        d = JSON.parse(dataStr);
      } catch {
        return;
      }
      handlers.onMeta?.(d);
      return;
    }
    case "delta": {
      let d: StreamDeltaEvent;
      try {
        d = JSON.parse(dataStr);
      } catch {
        // 兼容 data 直接就是纯文本增量的情况
        handlers.onDelta?.({ text: dataStr });
        return;
      }
      if (d.text !== undefined) handlers.onDelta?.(d);
      return;
    }
    case "refs": {
      let d: StreamRefsEvent;
      try {
        d = JSON.parse(dataStr);
      } catch {
        return;
      }
      if (d.references) handlers.onRefs?.(d);
      return;
    }
    case "followups": {
      let d: StreamFollowupsEvent;
      try {
        d = JSON.parse(dataStr);
      } catch {
        return;
      }
      if (d.items) handlers.onFollowups?.(d);
      return;
    }
    case "done": {
      let d: StreamDoneEvent;
      try {
        d = JSON.parse(dataStr);
      } catch {
        d = { duration_ms: 0, status: "done" };
      }
      handlers.onDone?.(d);
      return;
    }
    case "error": {
      let d: StreamErrorEvent;
      try {
        const parsed = JSON.parse(dataStr);
        d = {
          code: Number(parsed.code) || 20004,
          message: parsed.message || dataStr,
        };
      } catch {
        d = { code: 20004, message: dataStr };
      }
      handlers.onError?.(d);
      return;
    }
    default:
      // 未知事件按 SSE 标准忽略
      return;
  }
}

/* --- 模式 B：调用 B 原型 /api/ai/chat 并做协议翻译 --- */
async function streamB(
  _messageId: string,
  handlers: StreamChatMessageHandlers,
  options: StreamOptions,
  payload?: {
    request: CreateChatSessionRequest;
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    webSearchSources?: ChatSource[];
  },
) {
  // 安全包装：任意 handler 抛错都不能中断流式（否则 SyntaxError 会导致 ReadableStream 中断）
  const safe: StreamChatMessageHandlers = {
    onMeta: (d) => { try { handlers.onMeta?.(d); } catch (e) { console.warn("[streamB] onMeta err:", e); } },
    onDelta: (d) => { try { handlers.onDelta?.(d); } catch (e) { console.warn("[streamB] onDelta err:", e); } },
    onRefs: (d) => { try { handlers.onRefs?.(d); } catch (e) { console.warn("[streamB] onRefs err:", e); } },
    onFollowups: (d) => { try { handlers.onFollowups?.(d); } catch (e) { console.warn("[streamB] onFollowups err:", e); } },
    onDone: (d) => { try { handlers.onDone?.(d); } catch (e) { console.warn("[streamB] onDone err:", e); } },
    onError: (d) => { try { handlers.onError?.(d); } catch (e) { console.warn("[streamB] onError err:", e); } },
  };

  if (!payload) {
    safe.onError!({
      code: 20004,
      message: "streamChatMessage(模式B) 缺少 modeBPayload",
    });
    return;
  }

  // 先模拟一次 meta 事件（让思考面板 UI 立即有反馈）
  const t0 = Date.now();
  safe.onMeta!({ phase: "检索中", read_count: 0 });

  // 如果 C 模块有前置联网搜索，先抛一次 refs 事件（模拟「先显示来源」）
  if (payload.webSearchSources && payload.webSearchSources.length > 0) {
    const refs: StreamRefsEvent["references"] = payload.webSearchSources.map(
      (s, idx) => ({
        ordinal: s.id || idx + 1,
        source_type: (s.type as any) ?? "paper",
        source_id: s.url ?? `src_${idx}`,
        title: s.title,
        venue: s.venue ?? null,
        org: null,
        authors: s.author ?? "",
        citation_count: Number((s.citations ?? "").replace(/\D/g, "")) || 0,
        recommended: !!s.recommended,
        url: s.url ?? null,
      }),
    );
    safe.onRefs!({ references: refs });
    safe.onMeta!({ phase: "正在生成", read_count: refs.length });
  }

  // 调用 B 原型 /api/ai/chat
  const body = {
    mode: "ai" as const,
    message: payload.request.question,
    model: payload.request.model,
    // style 字段：把 idea/doubt 映射回 B 旧版 inspire/question（避免后端报 SCHEMA_ERROR）
    style: mapToBStyle(payload.request.mode),
    webSearch: payload.request.web_search,
    attachments: payload.request.attachments as any,
    messages: payload.messages,
  };

  try {
    await readSSEStream(
      new Request("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      {
        signal: options.signal,
        headers: options.headers,
        onEvent: (_eventName, dataStr) => {
          // /api/ai/chat 走的是 { type, ... } 格式，dataStr 就是 JSON
          if (dataStr === "[DONE]") {
            safe.onDone?.({
              status: "done",
              duration_ms: Date.now() - t0,
            });
            return;
          }
          let ev: ChatStreamEvent;
          try {
            ev = JSON.parse(dataStr);
          } catch {
            // 兜底：如果 /api/ai/chat 返回纯文本增量（未来修改可能），直接当 delta；空字符串忽略
            if (dataStr) safe.onDelta?.({ text: dataStr });
            return;
          }

          switch (ev.type) {
            case "token":
              safe.onDelta?.({ text: ev.token ?? "" });
              break;
            case "sources": {
              if (!ev.sources) break;
              // 把 ChatSource[] → ChatReference[]
              const refs: StreamRefsEvent["references"] = ev.sources.map((s) => ({
                ordinal: s.id,
                source_type: (s.type as any) ?? "paper",
                source_id: s.url ?? `src_${s.id}`,
                title: s.title,
                venue: s.venue ?? null,
                org: null,
                authors: s.author ?? "",
                citation_count:
                  Number((s.citations ?? "").replace(/\D/g, "")) || 0,
                recommended: !!s.recommended,
                url: s.url ?? null,
              }));
              safe.onRefs?.({ references: refs });
              break;
            }
            case "done": {
              // ⚠️ B 原型后端旧协议（token/sources/done）没有 followups 事件 → 在 done 之前合成追问建议
              // （和 A 后端风格一致的追问条，渲染为 FollowUpsBar 按钮）
              const q = payload.request.question ?? "";
              const builtin: string[] = [
                `简要总结关于「${q.slice(0, 12)}」的要点`,
                "能否列出核心概念的对比关系？",
                "请给出可落地的入门学习路径",
              ];
              // 如果 payload 里 webSearch 有结果，再补一个"深入某篇"的追问
              const refsInferred = payload.webSearchSources?.slice(0, 1);
              const items: string[] = refsInferred && refsInferred[0]
                ? [
                    `展开讲解「${refsInferred[0].title?.slice(0, 18) ?? "代表性论文"}」的核心贡献`,
                    ...builtin.slice(0, 2),
                  ]
                : builtin;
              safe.onFollowups?.({ items });

              safe.onDone?.({
                status: "done",
                duration_ms: Date.now() - t0,
              });
              break;
            }
            case "error":
              safe.onError?.({
                code: Number(ev.code) || 20004,
                message: ev.message ?? "AI 响应错误",
              });
              break;
            default:
              return;
          }
        },
      },
    );
  } catch (e) {
    // AbortSignal 中断是正常行为，不抛错
    if (options.signal?.aborted) return;
    safe.onError?.({
      code: 20004,
      message: String((e as Error)?.message || e),
    });
  }
}

/** ChatReplyMode（A 命名） → ChatStyle（B 旧命名） 映射 */
export function mapToBStyle(mode: CreateChatSessionRequest["mode"]) {
  switch (mode) {
    case "idea":
      return "inspire";
    case "doubt":
      return "question";
    default:
      return mode;
  }
}

/** ChatStyle（B 旧命名） → ChatReplyMode（A 命名） 反向映射 */
export function mapToAMode(
  style: "fast" | "deep" | "inspire" | "question",
): CreateChatSessionRequest["mode"] {
  switch (style) {
    case "inspire":
      return "idea";
    case "question":
      return "doubt";
    default:
      return style;
  }
}

/* ---- 停止 & 恢复 ---- */

export async function stopChatMessage(messageId: string): Promise<void> {
  if (AI_BACKEND_MODE === "A") {
    await shenzhiFetch(`${V1_PREFIX}/search/messages/${messageId}/stop`, {
      method: "POST",
    });
  }
  // 模式 B：不发网络请求，调用方自己通过 AbortSignal 中断即可
}

export async function resumeChatMessage(
  messageId: string,
): Promise<CreateChatSessionResponse> {
  if (AI_BACKEND_MODE === "A") {
    return shenzhiFetch<CreateChatSessionResponse>(
      `${V1_PREFIX}/search/messages/${messageId}/resume`,
      { method: "POST" },
    );
  }
  // 模式 B：返回同一个 message_id 即可，调用方会用 streamChatMessage 重拉
  return { session_id: "", message_id: messageId };
}

/* =========================================================================
 *  4. 获取 SearchConfig（模型列表 / 额度 / 上传配置）
 * ======================================================================= */

export async function getSearchConfig(): Promise<SearchConfig> {
  if (AI_BACKEND_MODE === "A") {
    try {
      return await shenzhiFetch<SearchConfig>(`${V1_PREFIX}/search/config`);
    } catch {
      return FALLBACK_SEARCH_CONFIG;
    }
  }
  // 模式 B：返回与 A 一致的结构（enabled=true 便于本地测试）
  return {
    ...FALLBACK_SEARCH_CONFIG,
    models: FALLBACK_SEARCH_CONFIG.models.map((m) => ({
      ...m,
      enabled: true, // 本地开发：3 档模型全部开启
    })),
    upload: {
      ...FALLBACK_SEARCH_CONFIG.upload,
      accept: [".pdf", ".txt", ".md"],
    },
  };
}

/* =========================================================================
 *  5. 把旧 B 模块的 ChatUIMessage 附件 / 消息格式 → A 请求体
 * ======================================================================= */

/**
 * 统一构造 CreateChatSessionRequest。
 * 参数全部采用语义名，不暴露 mode/model 命名差异。
 */
export function buildCreateSessionRequest(opts: {
  question: string;
  /** A 风格 mode（fast/deep/idea/doubt）—— 直接传经过 mapToAMode 的结果 */
  mode: CreateChatSessionRequest["mode"];
  /** 模型 ID：接受 ChatModelId 或任意自定义字符串（gpt-4o 等） */
  model: string;
  webSearch: boolean;
  /** B 风格 attachments（C 模块写入 store 的结构），会自动 toAAttachment 转换 */
  attachments: BChatAttachment[];
  /** 默认 "chat"；以后 deep-research 场景传 "research" */
  type?: CreateChatSessionRequest["type"];
}): CreateChatSessionRequest {
  return {
    type: opts.type ?? "chat",
    question: opts.question,
    mode: opts.mode,
    model: (opts.model as CreateChatSessionRequest["model"]) ?? "default",
    web_search: opts.webSearch,
    attachments: toAAttachment(opts.attachments),
  };
}

export type { ChatUIMessage };
