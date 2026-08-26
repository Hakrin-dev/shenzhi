import { AppShell } from "@/components/common/layout/app-shell";
import { AgentChat } from "@/features/chat/components/agent-chat";
import type { ChatModelId, ChatReplyMode } from "@/types/ai-search";

/** 首页问 AI 兼容入口，与 /agents 共用 Chat Feature。 */
export function AskPage({
  question,
  initialMode,
  initialModel,
  initialWebSearch,
}: {
  question: string;
  initialMode?: ChatReplyMode;
  initialModel?: ChatModelId;
  initialWebSearch?: boolean;
}) {
  return (
    <AppShell>
      <AgentChat
        key={question}
        question={question}
        initialMode={initialMode}
        initialModel={initialModel}
        initialWebSearch={initialWebSearch}
      />
    </AppShell>
  );
}
