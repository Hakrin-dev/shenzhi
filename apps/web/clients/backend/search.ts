import { apiJson } from "./http";
import type { FeedPaper, Scholar } from "@/types";
import type { SearchConfig } from "@/types/ai-search";
import { CHAT_MODEL_CATALOG } from "@/lib/data/chat-models";

export const FALLBACK_SEARCH_CONFIG: SearchConfig = {
  models: CHAT_MODEL_CATALOG.map((model) => ({ ...model, enabled: false })),
  quota_enforced: false,
  modes: ["fast", "deep", "idea", "doubt"],
  quota: { used: 0, limit: 20, deep_used: 0, deep_limit: 5 },
  upload: {
    max_size_mb: 20,
    max_files: 5,
    accept: [".pdf", ".md", ".markdown", ".txt"],
  },
};

export interface ExploreSearchResponse {
  papers: FeedPaper[];
  scholars: Scholar[];
  source: "retrieval" | "retrieval_empty" | "local";
  total?: number;
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
