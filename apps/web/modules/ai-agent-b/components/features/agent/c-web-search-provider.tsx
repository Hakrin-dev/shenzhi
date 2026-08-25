"use client";

/**
 * C 模块 · 联网搜索 Provider
 *
 * 职责：挂载在 AgentChat 根节点外层，组件 mount 时把「联网搜索函数」
 * 注册进 composer store（registerWebSearchFn），unmount 时注销。
 *
 * 之后 B 层发送流程（chat-stream.ts send）：
 *   开启联网开关 && webSearchFn 非空 → 发送前先 POST /api/web-search 拿真实搜索结果
 *   → 结果拼进 system prompt（buildWebSearchContext）+ 通过 onRefs 渲染来源卡片。
 *
 * 行为约定：
 *   - 后端没配 TAVILY_API_KEY / SEARXNG_BASE_URL 时，/api/web-search 返回空 sources，
 *     这里返回 []（不 throw），B 层自动跳过联网步骤，对话正常继续。
 */

import { useEffect, type ReactNode } from "react";
import { useComposerStore } from "@b/stores/composer";
import type { ChatSource } from "@b/types";

/** 挂载/卸载时注册/注销 webSearchFn，无需任何 props */
export function CWebSearchProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    useComposerStore.getState().registerWebSearchFn(async (query: string) => {
      try {
        const res = await fetch("/api/b/web-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, max_results: 6 }),
          signal: AbortSignal.timeout(12_000),
        });
        const json = (await res.json()) as {
          code?: number;
          message?: string;
          data?: { sources?: ChatSource[] };
        };
        if (!res.ok || json.code !== 0) {
          console.warn("[C] /api/web-search 失败:", json.message);
          return [];
        }
        return json.data?.sources ?? [];
      } catch (e) {
        console.warn("[C] /api/web-search 异常:", e);
        return [];
      }
    });
    return () => {
      useComposerStore.getState().registerWebSearchFn(null);
    };
  }, []);

  return <>{children}</>;
}
