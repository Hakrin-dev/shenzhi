/** 与 docs/dev/项目介绍.md 及 PRD 对齐的会话 / 流式契约 */

export type ChatSessionType = "research" | "chat";

export type ChatReplyMode = "fast" | "deep" | "idea" | "doubt";

/** 具体大模型 ID，如 deepseek-chat、gpt-4o */
export type ChatModelId = string;

export type ModelProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
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

export interface ChatAttachment {
  kind: ChatAttachmentKind;
  file_id?: string;
  ref_id?: string;
  title?: string;
  warning?: string;
}

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
  last_event_id?: string;
}

export type ChatMessageStatus = "streaming" | "done" | "failed" | "stopped";

export type ChatSourceType =
  | "paper"
  | "patent"
  | "funding"
  | "scholar"
  | "institution"
  | "web";

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

export interface StreamMetaEvent {
  read_count?: number;
  phase?: string;
  ephemeral?: boolean;
  arxiv_resolved?: number;
  context_truncated?: boolean;
  warnings?: string[];
}

export interface StreamDeltaEvent {
  text?: string;
  reasoning?: string;
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
}

export interface StreamErrorEvent {
  code: number;
  message: string;
}

export interface SearchModelOption {
  value: ChatModelId;
  /** 列表与 pill 上显示的模型名 */
  label: string;
  provider: ModelProvider;
  enabled: boolean;
  reason?: string;
  description?: string;
}

export interface SearchConfig {
  default_model?: string;
  quota_enforced?: boolean;
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

/** 首页分流仍用 entryMode；发给生成接口的是 question / mode / model / web_search / attachments */
export interface ComposerSubmitPayload {
  entryMode: "search" | "ai";
  question: string;
  mode: ChatReplyMode;
  model: ChatModelId;
  web_search: boolean;
  attachments: ChatAttachment[];
}

/** Backend protocol types shared by Chat and the search/home composer. */
export interface ChatSessionSummary {
  id: string;
  title: string;
  favorite: boolean;
  updated_at: number;
  mode: ChatReplyMode;
  model: ChatModelId;
  web_search: boolean;
}

export interface ChatStoredMessage {
  last_event_id: string;
  id: string;
  question: string;
  content: string;
  reasoning: string;
  status: ChatMessageStatus;
  references: ChatReference[];
  followups: string[];
  duration_ms: number;
  error: string | null;
  warnings: string[];
}

export interface ChatSessionDetail extends ChatSessionSummary {
  messages: ChatStoredMessage[];
}
