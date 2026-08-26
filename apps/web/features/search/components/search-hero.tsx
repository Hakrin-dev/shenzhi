"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ComposerShell } from "@/features/chat/components/composer";
import { SearchResults } from "@/features/search/components/search-results";
import { getSearchConfig } from "@/clients/backend/search";
import { askQueryString, saveAskDraft } from "@/features/chat/services/draft";
import type { ComposerSubmitPayload, SearchConfig } from "@/types/ai-search";

const PLACEHOLDER =
  "用自然语言提问，例如 Diffusion Policy 有什么创新？";

/** 首页入口 —— Enter 问 AI，Alt+Enter 在本页下方展示搜索结果 */
export function SearchHero({
  initialQuery = "",
  onSearchActiveChange,
}: {
  initialQuery?: string;
  onSearchActiveChange?: (active: boolean) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [inlineSearch, setInlineSearch] = useState<string | null>(null);
  const [config, setConfig] = useState<SearchConfig | undefined>();

  useEffect(() => {
    void getSearchConfig().then(setConfig);
  }, []);

  useEffect(() => {
    onSearchActiveChange?.(Boolean(inlineSearch));
  }, [inlineSearch, onSearchActiveChange]);

  const send = (payload: ComposerSubmitPayload) => {
    if (!payload.question) return;
    if (payload.entryMode === "search") {
      setInlineSearch(payload.question);
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
        onSend={send}
        placeholder={PLACEHOLDER}
        config={config}
      />
      <p className="mt-2 px-1 text-[11px] text-faint lg:hidden">
        Enter 发送 · Shift+Enter 换行 · Alt+Enter 搜索论文
      </p>
      {inlineSearch && (
        <div className="mt-5">
          <SearchResults query={inlineSearch} />
        </div>
      )}
    </div>
  );
}
