import { apiJson } from "./http";
import type { FeedPaper, Scholar } from "@/types";

export interface ExploreSearchResponse {
  papers: FeedPaper[];
  scholars: Scholar[];
  source: "retrieval" | "retrieval_empty" | "local";
  total?: number;
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
