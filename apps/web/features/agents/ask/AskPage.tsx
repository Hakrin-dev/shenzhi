import { AppShell } from "@/components/layout/app-shell";
import { AskStage } from "@/features/agents/ask/components/ask-stage";
import type { ChatModelId, ChatReplyMode } from "@/types/ai-search";

/** 首页「问 AI」：按正式会话接口建会话并拉流，不改原 `/agents` */
export function AskPage({
  question,
  initialMode,
  initialModel,
  initialWebSearch,
}: {
  question: string;
  initialMode?: ChatReplyMode;
  initialModel?: ChatModelId;
  initialWebSearch: boolean;
}) {
  return (
    <AppShell>
      <AskStage
        question={question}
        initialMode={initialMode}
        initialModel={initialModel}
        initialWebSearch={initialWebSearch}
      />
    </AppShell>
  );
}
