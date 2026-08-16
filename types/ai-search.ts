/** 与 docs/dev/AI搜索-开发文档.md 对齐的会话 / 流式契约 */

export type ChatSessionType = "research" | "chat";

export type ChatReplyMode = "fast" | "deep" | "idea" | "doubt";

export type ChatModelId = "default" | "subscription" | "byok";

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
}

export interface StreamErrorEvent {
  code: number;
  message: string;
}

export interface SearchModelOption {
  value: ChatModelId;
  label: string;
  enabled: boolean;
  reason?: string;
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

/** 首页分流仍用 entryMode；发给生成接口的是 question / mode / model / web_search / attachments */
export interface ComposerSubmitPayload {
  entryMode: "search" | "ai";
  question: string;
  mode: ChatReplyMode;
  model: ChatModelId;
  web_search: boolean;
  attachments: ChatAttachment[];
}
