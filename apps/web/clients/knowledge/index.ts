"use client";

import type { KnowledgeClient } from "./client";
import { BffKnowledgeClient } from "./bff";
import { MockKnowledgeClient } from "./mock";

export { KnowledgeClientError } from "./client";
export type { KnowledgeClient } from "./client";
export { MockKnowledgeClient } from "./mock";
export type { MockKnowledgeClientOptions, MockScenario } from "./mock";
export { BffKnowledgeClient } from "./bff";

export type {
  KnowledgeSearchParams,
  KnowledgePaperHit,
  KnowledgePaperDetail,
  KnowledgeGraph,
  KnowledgeGraphNode,
  KnowledgeGraphNodeProperties,
  KnowledgeGraphEdge,
  KnowledgeGraphRelation,
  KnowledgeNodeKind,
  KnowledgeRelatedPaper,
  KnowledgeRelationDirection,
  KnowledgeErrorCode,
  KnowledgeApiError,
} from "./types";
export { KNOWLEDGE_RELATION_LABELS } from "./types";

/**
 * 知识底座 Client 工厂。
 *
 * 默认使用 Mock（页面开发阶段）；设置环境变量
 *   NEXT_PUBLIC_KNOWLEDGE_SOURCE=bff
 * 后切换到 BffKnowledgeClient（走 ShenZhi FastAPI，真实联调）。
 */
export function getKnowledgeClient(): KnowledgeClient {
  const source =
    typeof process !== "undefined" && typeof process.env !== "undefined"
      ? process.env.NEXT_PUBLIC_KNOWLEDGE_SOURCE
      : undefined;

  if (source === "bff") return new BffKnowledgeClient();
  return new MockKnowledgeClient();
}
