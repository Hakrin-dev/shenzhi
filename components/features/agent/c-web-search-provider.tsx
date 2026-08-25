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
 *   - 搜索失败（Key 无效 / 网络超时等）时 throw，
 *     chat-stream catch 后把失败原因注入思考面板 ⚠️，对话本身继续（不中断）。
 *   - 后端返回空 sources（正常无结果）时返回 []，B 层自动跳过联网步骤。
 */

import { useEffect, type ReactNode } from "react";
import { useComposerStore } from "@/stores/composer";
import type { ChatSource } from "@/types";

/** 挂载/卸载时注册/注销 webSearchFn，无需任何 props */
export function CWebSearchProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    useComposerStore.getState().registerWebSearchFn(async (query: string) => {
      const res = await fetch("/api/web-search", {
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
        // 上抛而不是静默返回 []：chat-stream 会把失败原因注入思考面板 ⚠️，
        // 让用户知道「联网开关开了但搜索失败」（如 Key 无效），而不是无感知
        throw new Error(json.message || `联网搜索失败（HTTP ${res.status}）`);
      }
      return json.data?.sources ?? [];
    });
    return () => {
      useComposerStore.getState().registerWebSearchFn(null);
    };
  }, []);

  return <>{children}</>;
}
