"use client";

/**
 * UPDATE: 2026-08-18 A+B 单前端整合
 * —— 从 A 模块 (shenzhi-feat-ai_agent_front) 的完整版替换 B 旧 search-hero
 * —— 关键变更：AI 模式 send() 从跨端口 window.location.href 改为同域 router.push("/agents/ask")
 * —— 对应修改日志：任务日志/对于A的修改/2026.8.18-A+B整合单前端化修改.md
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ComposerShell } from "@/components/features/agent/composer";
import { getSearchConfig } from "@/lib/api/search";
import { askQueryString, saveAskDraft } from "@/lib/ask/draft";
import type { ComposerEntryMode } from "@/types";
import type { ComposerSubmitPayload, SearchConfig } from "@/types/ai-search";

const PLACEHOLDER: Record<ComposerEntryMode, string> = {
  search: "搜索论文、专利或学者，例如 Diffusion Policy…",
  ai: "用自然语言提问，例如 Diffusion Policy 有什么创新？",
};

/** 首页入口 —— 「搜索 / 问 AI」分流；问 AI 携带正式请求字段到 /agents/ask */
export function SearchHero({
  initialQuery = "",
  initialMode = "search",
}: {
  initialQuery?: string;
  initialMode?: ComposerEntryMode;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [entryMode, setEntryMode] = useState<ComposerEntryMode>(initialMode);
  const [config, setConfig] = useState<SearchConfig | undefined>();

  useEffect(() => {
    void getSearchConfig().then(setConfig);
  }, []);

  const send = (payload: ComposerSubmitPayload) => {
    if (!payload.question) return;
    if (payload.entryMode === "search") {
      router.push(`/search?q=${encodeURIComponent(payload.question)}`);
      return;
    }
    // UPDATE: 2026-08-18 A+B 单前端整合
    //  旧代码：window.location.href = `http://localhost:3000/agents/ask?${qs}`（跨 A=3001 / B=3000 端口跳转导致 sessionStorage 无法共享附件）
    //  新代码：router.push(`/agents/ask?${qs}`)（单前端同域，URL query 四参契约 q/mode/model/web_search 不变，saveAskDraft 写入的草稿可被 /agents/ask 读取）
    saveAskDraft(payload);
    const qs = askQueryString(payload);
    router.push(`/agents/ask?${qs}`);
  };

  return (
    <div>
      <ComposerShell
        variant="home"
        value={value}
        onChange={setValue}
        entryMode={entryMode}
        onEntryModeChange={setEntryMode}
        onSend={send}
        placeholder={PLACEHOLDER[entryMode]}
        menuPlacement="down"
        config={config}
      />
      <p className="mt-2 px-1 text-[11px] text-faint">
        Enter 按当前模式提交 · Alt+Enter 搜索论文 · Shift+Enter 换行
      </p>
    </div>
  );
}
