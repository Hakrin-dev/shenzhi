"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ComposerShell } from "@/features/agents/components/composer";
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
  initialMode = "ai",
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
    saveAskDraft(payload);
    router.push(`/agents/ask?${askQueryString(payload)}`);
  };

  return (
    <div className="overflow-visible">
      <ComposerShell
        variant="home"
        value={value}
        onChange={setValue}
        entryMode={entryMode}
        onEntryModeChange={setEntryMode}
        onSend={send}
        placeholder={PLACEHOLDER[entryMode]}
        config={config}
      />
      <p className="mt-2 px-1 text-[11px] text-faint sm:hidden">
        Enter 按当前模式提交 · Alt+Enter 搜索论文
      </p>
    </div>
  );
}
