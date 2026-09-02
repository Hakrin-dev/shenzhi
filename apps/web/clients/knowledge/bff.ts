"use client";

import { apiJson, ApiError } from "@/clients/backend/http";
import { KnowledgeClientError, type KnowledgeClient } from "./client";
import type {
  KnowledgeGraph,
  KnowledgePaperDetail,
  KnowledgePaperHit,
  KnowledgeSearchParams,
} from "./types";

/**
 * 知识底座 BFF Client：经 ShenZhi FastAPI 访问知识底座科研组能力。
 *
 * 页面无感知：只需把 getKnowledgeClient() 的默认实现从 Mock 切到本实现，
 * 页面代码无需大改。请求统一走同源 /api/v1（Next.js BFF 转发）。
 */

/** 后端知识错误码 → 契约错误码 */
const BACKEND_ERROR_CODE_MAP: Record<number, KnowledgeClientError["code"]> = {
  21001: "INVALID_ARGUMENT",
  21002: "NOT_FOUND",
  21003: "RATE_LIMITED",
  21004: "UPSTREAM_UNAVAILABLE",
  21005: "TIMEOUT",
  21006: "CONTRACT_VIOLATION",
  21007: "UNKNOWN",
};

function toKnowledgeError(error: unknown): KnowledgeClientError {
  if (error instanceof KnowledgeClientError) return error;
  if (error instanceof ApiError) {
    const code = BACKEND_ERROR_CODE_MAP[error.code] ?? "UNKNOWN";
    const retryable = ["RATE_LIMITED", "UPSTREAM_UNAVAILABLE", "TIMEOUT"].includes(code);
    return new KnowledgeClientError(code, error.message, { retryable });
  }
  return new KnowledgeClientError(
    "UNKNOWN",
    error instanceof Error ? error.message : "知识底座服务异常",
  );
}

export class BffKnowledgeClient implements KnowledgeClient {
  async search(params: KnowledgeSearchParams): Promise<{ results: KnowledgePaperHit[] }> {
    try {
      return await apiJson<{ results: KnowledgePaperHit[] }>("/knowledge/search", {
        method: "POST",
        body: JSON.stringify({
          query: params.query,
          topK: params.topK,
          yearFrom: params.yearFrom,
          yearTo: params.yearTo,
          venue: params.venue,
          author: params.author,
          keyword: params.keyword,
          subject: params.subject,
        }),
      });
    } catch (error) {
      throw toKnowledgeError(error);
    }
  }

  async paper(paperId: string): Promise<KnowledgePaperDetail> {
    try {
      return await apiJson<KnowledgePaperDetail>(
        `/knowledge/paper?paperId=${encodeURIComponent(paperId)}`,
      );
    } catch (error) {
      throw toKnowledgeError(error);
    }
  }

  async graph(paperId: string, depth = 1): Promise<KnowledgeGraph> {
    try {
      return await apiJson<KnowledgeGraph>(
        `/knowledge/graph?paperId=${encodeURIComponent(paperId)}&depth=${depth}`,
      );
    } catch (error) {
      throw toKnowledgeError(error);
    }
  }
}
