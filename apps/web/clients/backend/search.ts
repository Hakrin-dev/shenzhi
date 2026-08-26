import { apiJson, apiPath } from "@/lib/api/http";
import { readSseStream, type SseEvent } from "@/lib/sse";
import type { FeedPaper, Scholar } from "@/types";
import type {
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
import { CHAT_MODEL_CATALOG } from "@/lib/data/chat-models";

export const FALLBACK_SEARCH_CONFIG: SearchConfig = {
  models: CHAT_MODEL_CATALOG,
  modes: ["fast", "deep", "idea", "doubt"],
  quota: { used: 0, limit: 20, deep_used: 0, deep_limit: 5 },
  upload: {
    max_size_mb: 20,
    max_files: 5,
    accept: [".pdf", ".docx", ".md", ".txt"],
  },
};

export interface ExploreSearchResponse {
  papers: FeedPaper[];
  scholars: Scholar[];
  source: "retrieval" | "retrieval_empty" | "local";
  total?: number;
}

export function createChatSession(
  body: CreateChatSessionRequest,
  init?: RequestInit,
) {
  return apiJson<CreateChatSessionResponse>("/search/sessions", {
    method: "POST",
    body: JSON.stringify(body),
    ...init,
  });
}

export function sendChatMessage(
  sessionId: string,
  body: SendChatMessageRequest,
  init?: RequestInit,
) {
  return apiJson<CreateChatSessionResponse>(
    `/search/sessions/${sessionId}/messages`,
    { method: "POST", body: JSON.stringify(body), ...init },
  );
}

export function stopChatMessage(messageId: string) {
  return apiJson<{ ok: boolean }>(`/search/messages/${messageId}/stop`, {
    method: "POST",
  });
}

export function resumeChatMessage(messageId: string) {
  return apiJson<CreateChatSessionResponse>(
    `/search/messages/${messageId}/resume`,
    { method: "POST" },
  );
}

export async function getSearchConfig(): Promise<SearchConfig> {
  try {
    return await apiJson<SearchConfig>("/search/config");
  } catch {
    return FALLBACK_SEARCH_CONFIG;
  }
}

/** 论文检索：FastAPI 代理外部 retrieval 服务；失败时由调用方 fallback */
export function exploreSearch(query: string, mode: "fast" | "deep" = "fast") {
  return apiJson<ExploreSearchResponse>("/search/explore", {
    method: "POST",
    body: JSON.stringify({
      query: query.trim(),
      top_k: mode === "deep" ? 10 : 5,
      mode,
    }),
  });
}

export interface ChatStreamHandlers {
  onMeta?: (data: StreamMetaEvent) => void;
  onDelta?: (data: StreamDeltaEvent) => void;
  onRefs?: (data: StreamRefsEvent) => void;
  onFollowups?: (data: StreamFollowupsEvent) => void;
  onDone?: (data: StreamDoneEvent) => void;
  onError?: (data: StreamErrorEvent) => void;
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function streamChatMessage(
  messageId: string,
  handlers: ChatStreamHandlers,
  options: { signal?: AbortSignal; lastEventId?: string } = {},
) {
  let lastId = options.lastEventId;

  const dispatch = (event: SseEvent) => {
    if (event.id) lastId = event.id;
    switch (event.event) {
      case "meta": {
        const data = parseJson<StreamMetaEvent>(event.data);
        if (data) handlers.onMeta?.(data);
        break;
      }
      case "delta": {
        const data = parseJson<StreamDeltaEvent>(event.data);
        if (data) handlers.onDelta?.(data);
        break;
      }
      case "refs": {
        const data = parseJson<StreamRefsEvent>(event.data);
        if (data?.references) handlers.onRefs?.(data);
        break;
      }
      case "followups": {
        const data = parseJson<StreamFollowupsEvent>(event.data);
        if (data?.items) handlers.onFollowups?.(data);
        break;
      }
      case "done": {
        const data = parseJson<StreamDoneEvent>(event.data) ?? {
          duration_ms: 0,
          status: "done",
        };
        handlers.onDone?.(data);
        break;
      }
      case "error": {
        const data = parseJson<StreamErrorEvent>(event.data) ?? {
          code: 20004,
          message: event.data,
        };
        handlers.onError?.(data);
        break;
      }
      default:
        break;
    }
  };

  await readSseStream(apiPath(`/search/messages/${messageId}/stream`), {
    signal: options.signal,
    lastEventId: lastId,
    onEvent: dispatch,
  });

  return lastId;
}

