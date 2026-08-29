"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ComposerShell } from "@/features/chat/components/composer";
import { SearchResults } from "@/features/search/components/search-results";
import { getChatConfig } from "@/clients/backend/chat";
import { askQueryString, saveAskDraft } from "@/features/chat/services/draft";
import type { ComposerEntryMode } from "@/types";
import type { ComposerSubmitPayload, ChatConfig } from "@/types/ai-search";

const PLACEHOLDER_SEARCH = "请输入想检索的问题";
const PLACEHOLDER_AI = "用自然语言提问，例如 Diffusion Policy 有什么创新？";

/** 首页 Hero —— 简单搜索查论文库，智能搜索跳转问 AI */
export function SearchHero({
  initialQuery = "",
  onSearchActiveChange,
}: {
  initialQuery?: string;
  onSearchActiveChange?: (active: boolean) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [entryMode, setEntryMode] = useState<ComposerEntryMode>("ai");
  const [inlineSearch, setInlineSearch] = useState<string | null>(null);
  const [config, setConfig] = useState<ChatConfig | undefined>();

  useEffect(() => {
    void getChatConfig().then(setConfig);
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
    <div className="w-full overflow-visible">
      <ComposerShell
        variant="home"
        value={value}
        onChange={setValue}
        onSend={send}
        placeholder={entryMode === "search" ? PLACEHOLDER_SEARCH : PLACEHOLDER_AI}
        entryMode={entryMode}
        onEntryModeChange={setEntryMode}
        config={config}
      />
      {inlineSearch && (
        <div className="mt-6">
          <SearchResults query={inlineSearch} />
        </div>
      )}
    </div>
  );
}
