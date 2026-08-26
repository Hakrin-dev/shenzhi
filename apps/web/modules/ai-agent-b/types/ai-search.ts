/* =========================================================
 *  AI 搜索前端类型契约 —— 严格对齐 A 模块 (shenzhi-feat-ai_agent_front)
 *  A / B / C 三模块共用，任何修改需同步三方。
 *  本文件为「契约源」，其他文件从这里 re-export。
 * ========================================================= */

/* ---------- 枚举 & 联合类型 ---------- */

/** 双模式入口：搜索论文 / 问 AI */
export type EntryMode = "search" | "ai";

/** 四种回复模式（A 模块标准命名） */
export type ChatReplyMode = "fast" | "deep" | "idea" | "doubt";
//                     快速    深度     灵感      质疑

/** 三种模型档位（A 模块 search-hero 会传这 3 种） */
export type ChatModelId = "default" | "subscription" | "byok";

/** 会话类型（创建会话时必填） */
export type ChatSessionType = "research" | "chat";

/** 8 种附件引用类型（A 模块 composer 附件菜单分类） */
export type ChatAttachmentKind =
  | "file"        // 本地文件 → 用 file_id
  | "paper"       // 论文引用 → 用 ref_id
  | "patent"      // 专利引用
  | "funding"     // 基金项目引用
  | "scholar"     // 学者引用
  | "institution" // 机构引用
  | "session"     // 历史对话引用
  | "project";    // 科研项目引用

/** 引用来源类型（refs 事件中的 source_type） */
export type ChatSourceType =
  | "paper"
  | "patent"
  | "funding"
  | "scholar"
  | "institution"
  | "web";

/* ---------- 附件结构（A 模块 ComposerSubmitPayload） ---------- */

/**
 * A 模块的附件结构 —— 与 B 模块旧版 ChatAttachment 不同。
 * 本地上传后可在前端携带解析结果 text（B 模式 /api/b/uploads 返回），发送时注入 prompt。
 */
export interface ChatAttachment {
  kind: ChatAttachmentKind;
  /** kind === "file" 时使用：服务端返回的文件资源 ID */
  file_id?: string;
  /** 其他 kind 时使用：平台实体 ID（论文 ID、学者 ID 等） */
  ref_id?: string;
  /** 前端显示用的附件名称（如文件名、论文标题） */
  title?: string;
  /** 上传解析后的正文（B 模式本地解析，发送前注入 system prompt） */
  text?: string;
  error?: string;
  size?: number;
  type?: "pdf" | "txt" | "md" | "other";
}

/* ---------- 创建会话请求（A → 后端 / B → 适配层） ---------- */

export interface CreateChatSessionRequest {
  type: ChatSessionType;    // "research" 或 "chat"
  question: string;         // 问题文本，1-2000 字
  mode: ChatReplyMode;      // 快速/深度/灵感/质疑
  /** 默认/订阅/API接入 + 允许 BYOK 传任意模型名（如 "gpt-4o"） */
  model: ChatModelId | string;
  web_search: boolean;      // 是否开启联网搜索
  attachments: ChatAttachment[]; // 附件数组
}

/* ---------- 会话/消息返回结构 ---------- */

/**
 * A 模块标准创建会话响应（两步法使用）。
 * lib/api/search.ts 模式 A 返回此格式，模式 B 会在前端模拟同样的字段。
 */
export interface CreateChatSessionResponse {
  session_id: string;
  message_id: string;
}

/** 续问（sendChatMessage）请求体：除了 question 其他可选 */
export interface SendChatMessageRequest {
  question: string;
  mode?: ChatReplyMode;
  /** 允许任意模型字符串（ChatModelId 三档常量 + BYOK 自定义） */
  model?: ChatModelId | string;
  web_search?: boolean;
  attachments?: ChatAttachment[];
}

/** 兼容旧 B 模块：ChatSession = CreateChatSessionResponse 的超集 */
export interface ChatSession {
  id: string;              // session_id，后续发消息 / 拉流需要
  type: ChatSessionType;
  first_message_id: string; // 首条助手消息 ID，用于立即拉流
  created_at: string;
}

/** UI 层 ChatMessageStatus（与 A 模块 ChatMessageStatus 对齐） */
export type ChatMessageStatus = "streaming" | "done" | "failed" | "stopped";

export interface ChatMessageMeta {
  read_count?: number;        // 已阅读参考文献数
  /**
   * phase 可能来自 A 后端的英文原词（"generating"/其他），
   * 也可能是 B 前端模拟的中文（"检索中"/"正在生成"），
   * UI 渲染层需做中英文映射。
   */
  phase?: string;
  context_truncated?: boolean; // 上下文是否被截断
}

export interface ChatMessageDone {
  duration_ms?: number;     // 总生成耗时（毫秒）
  status: "completed" | "stopped" | "interrupted";
}

/* ---------- 引用来源对象（refs 事件返回，A 标准命名 ChatReference） ---------- */

export interface ChatReference {
  ordinal: number;          // 正文中的 [N] 编号，从 1 连续，前端排序用
  source_type: ChatSourceType; // 来源类型
  source_id: string;        // 平台实体 ID 或 URL（source_type=web 时）
  title: string;            // 标题
  venue: string | null;     // 会议/期刊/国家等（根据 source_type 语义不同）
  org: string | null;       // 机构/申请人/依托单位
  authors: string;          // 作者（多个用逗号分隔）
  citation_count: number;   // 被引量
  recommended: boolean;     // 是否为推荐引用（A: true → 琥珀色高亮 + 黄底）
  url: string | null;       // 外部跳转链接
}

/* ---------- SSE 事件协议（A 模块标准 6 种事件） ---------- */

/**
 * GET /search/messages/{id}/stream 事件顺序：
 *   meta (0~N次) → delta (0~N次) → refs (0~1次)
 *   → followups (0~1次) → done | error
 *
 * 事件名约定：全部小写，对应 A 模块 lib/api/search.ts streamChatMessage() 的 switch。
 */
export type AISSEEventName =
  | "meta"       // 过程信息：{ read_count, phase, context_truncated }
  | "delta"      // 正文增量：{ text }
  | "refs"       // 引用来源（一次性）：{ references: ChatReference[] }
  | "followups"  // 追问建议（一次性）：{ items: string[] }
  | "done"       // 生成结束：{ duration_ms, status }
  | "error";     // 中途出错：{ code: string, message: string }

/** --------- A 模块 Stream 系列命名（A 模块契约原名） --------- */
/** meta 事件负载（A 协议原词 StreamMetaEvent）：phase 为英文原词，如 "generating" */
export interface StreamMetaEvent {
  read_count?: number;
  phase?: string;
  ephemeral?: boolean;
  arxiv_resolved?: number;
  context_truncated?: boolean;
  /** R1 思考链增量（Task 4）：流式逐 token 拼入 ChatUIMessage.thinkingContent */
  thinking_delta?: string;
  /**
   * R1 思考链完整版本（done 事件之前，后端可以在最后一帧 meta 里一次性给整段）。
   * 也兼容 done 里带 thinkingContent。二者 UI 层都接受。
   */
  thinkingContent?: string;
  /** 附件截断告警（Task 3）：任意自定义结构 */
  warning?: unknown;
}

/** delta 事件负载 */
export interface StreamDeltaEvent {
  text: string;
}

/** refs 事件负载 */
export interface StreamRefsEvent {
  references: ChatReference[];
}

/** followups 事件负载 */
export interface StreamFollowupsEvent {
  items: string[];
}

/** done 事件负载 */
export interface StreamDoneEvent {
  duration_ms: number;
  status: ChatMessageStatus;
  /** R1 思考链完整内容（Task 4）：后端 done 事件直接携带时的承载字段 */
  thinkingContent?: string;
}

/** error 事件负载（A 模块：code 是 number） */
export interface StreamErrorEvent {
  code: number;
  message: string;
}

/** --------- B 模块兼容别名（AIEventXxx = StreamXxxEvent 的宽松版本） ---------
 *  用于 B 模块前后端联调时 code 可能是 string 的场景。
 *  两套命名都在 types/index.ts 中 re-export。
 */

/** meta 事件负载（B 兼容：phase 可为任意字符串，含中文） */
export interface AIEventMeta extends StreamMetaEvent {}

/** delta 事件负载 */
export interface AIEventDelta extends StreamDeltaEvent {}

/** refs 事件负载 */
export interface AIEventRefs extends StreamRefsEvent {}

/** followups 事件负载 */
export interface AIEventFollowups extends StreamFollowupsEvent {}

/** done 事件负载（兼容 done.status 的多种字符串） */
export interface AIEventDone {
  duration_ms?: number;
  status: "completed" | "stopped" | "interrupted" | ChatMessageStatus;
  /** Task 4 · R1：完整思考链，透传 StreamDoneEvent.thinkingContent */
  thinkingContent?: string;
}

/** error 事件负载（B 兼容版本：code 可为 string，如 "NGROK_INTERCEPT"/"TIMEOUT" 等） */
export interface AIEventError {
  code: string | number;     // A 模块是 number (20001)，B 模块也支持 string
  message: string;          // 用户可读文案
}

/* ---------- A 模块 search-hero → B 模块 URL 参数 payload ---------- */

/**
 * A 模块用户点击「问 AI」发送时的 composer payload，
 * 包括草稿写入 sessionStorage、URL query string 构造两个出口。
 * 由 lib/ask/draft.ts 消费。
 */
export interface ComposerSubmitPayload {
  question: string;
  entryMode: EntryMode;
  mode: ChatReplyMode;       // A 用 ChatReplyMode，不是 B 旧 ChatStyle
  model: ChatModelId | string;
  web_search: boolean;
  /** 仅 entryMode === "ai" 时会带附件，search 模式下通常为 [] */
  attachments: ChatAttachment[];
}

/* ---------- SearchConfig（A 模块标准模型/额度/上传配置） ---------- */

export interface SearchModelOption {
  value: ChatModelId | string;
  label: string;
  enabled: boolean;
  reason?: string; // disabled 时的原因："not_subscribed" | "no_api_key" 等
}

export interface SearchConfig {
  models: SearchModelOption[];
  modes: ChatReplyMode[];
  quota: {
    used: number;
    limit: number;
    deep_used: number;
    deep_limit: number;
  };
  upload: {
    max_size_mb: number;
    max_files: number;
    accept: string[];
  };
}

/** 通用 A 后端 Envelope 包装（A 模块约定的 data 结构） */
export interface ApiEnvelope<T> {
  code: number;     // 0 = 成功；非 0 = 失败，此时 message 有值
  data?: T;
  message?: string;
}

/* ---------- 通用服务端错误包装（Next API Route） ---------- */

export interface SearchAPIError {
  code: string;    // 如 "20004"
  message: string; // 中文用户可读
}
