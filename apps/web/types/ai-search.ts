/** 前后端 AI 搜索 / 会话契约 — 单一来源（features + B 模块共用） */

/* ---------- 枚举 & 联合类型 ---------- */

export type EntryMode = "search" | "ai";

/** @deprecated 使用 EntryMode；保留别名兼容 B composer */
export type ComposerEntryMode = EntryMode;

export type ChatReplyMode = "fast" | "deep" | "idea" | "doubt";

/** 具体大模型 ID；兼容旧三档 default/subscription/byok */
export type ChatModelId = string;

export const LEGACY_CHAT_MODEL_IDS = [
  "default",
  "subscription",
  "byok",
] as const;

export type LegacyChatModelId = (typeof LEGACY_CHAT_MODEL_IDS)[number];

export type ChatSessionType = "research" | "chat";

export type ModelProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "qwen"
  | "zhipu"
  | "platform";

export type ChatAttachmentKind =
  | "file"
  | "paper"
  | "patent"
  | "funding"
  | "scholar"
  | "institution"
  | "session"
  | "project";

export type ChatSourceType =
  | "paper"
  | "patent"
  | "funding"
  | "scholar"
  | "institution"
  | "web";

/* ---------- 附件 ---------- */

export interface ChatAttachment {
  kind: ChatAttachmentKind;
  file_id?: string;
  ref_id?: string;
  title?: string;
  text?: string;
  error?: string;
  size?: number;
  type?: "pdf" | "txt" | "md" | "other";
}

/** 联网搜索 / 引用卡片（UI 层） */
export interface ChatSource {
  id: number;
  short?: string;
  title: string;
  venue?: string;
  author?: string;
  citations?: string;
  url?: string;
  tone?: "violet" | "green" | "amber" | "gray";
  recommended?: boolean;
  type?: ChatSourceType;
  snippet?: string;
}

/* ---------- 会话请求 / 响应 ---------- */

export interface CreateChatSessionRequest {
  type: ChatSessionType;
  question: string;
  mode: ChatReplyMode;
  model: ChatModelId;
  web_search: boolean;
  attachments: ChatAttachment[];
}

export interface SendChatMessageRequest {
  question: string;
  mode?: ChatReplyMode;
  model?: ChatModelId;
  web_search?: boolean;
  attachments?: ChatAttachment[];
}

export interface CreateChatSessionResponse {
  session_id: string;
  message_id: string;
}

export interface ChatSession {
  id: string;
  type: ChatSessionType;
  first_message_id: string;
  created_at: string;
}

export type ChatMessageStatus = "streaming" | "done" | "failed" | "stopped";

export interface ChatMessageMeta {
  read_count?: number;
  phase?: string;
  context_truncated?: boolean;
}

export interface ChatMessageDone {
  duration_ms?: number;
  status: "completed" | "stopped" | "interrupted";
}

/* ---------- 引用（A 协议 refs 事件） ---------- */

export interface ChatReference {
  ordinal: number;
  source_type: ChatSourceType;
  source_id: string;
  title: string;
  venue: string | null;
  org: string | null;
  authors: string;
  citation_count: number;
  recommended: boolean;
  url: string | null;
}

/* ---------- SSE 事件（A 协议） ---------- */

export type AISSEEventName =
  | "meta"
  | "delta"
  | "refs"
  | "followups"
  | "done"
  | "error";

export interface StreamMetaEvent {
  read_count?: number;
  phase?: string;
  ephemeral?: boolean;
  arxiv_resolved?: number;
  context_truncated?: boolean;
  thinking_delta?: string;
  thinkingContent?: string;
  warning?: unknown;
}

export interface StreamDeltaEvent {
  text: string;
}

export interface StreamRefsEvent {
  references: ChatReference[];
}

export interface StreamFollowupsEvent {
  items: string[];
}

export interface StreamDoneEvent {
  duration_ms: number;
  status: ChatMessageStatus;
  thinkingContent?: string;
}

export interface StreamErrorEvent {
  code: number;
  message: string;
}

export interface AIEventMeta extends StreamMetaEvent {}
export interface AIEventDelta extends StreamDeltaEvent {}
export interface AIEventRefs extends StreamRefsEvent {}
export interface AIEventFollowups extends StreamFollowupsEvent {}

export interface AIEventDone {
  duration_ms?: number;
  status: "completed" | "stopped" | "interrupted" | ChatMessageStatus;
  thinkingContent?: string;
}

export interface AIEventError {
  code: string | number;
  message: string;
}

/* ---------- Composer / SearchConfig ---------- */

export interface ComposerSubmitPayload {
  question: string;
  entryMode: EntryMode;
  mode: ChatReplyMode;
  model: ChatModelId;
  web_search: boolean;
  attachments: ChatAttachment[];
}

export interface SearchModelOption {
  value: ChatModelId;
  label: string;
  provider: ModelProvider;
  enabled: boolean;
  reason?: string;
  description?: string;
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

export interface ApiEnvelope<T> {
  code: number;
  data?: T;
  message?: string;
}

export interface SearchAPIError {
  code: string;
  message: string;
}
