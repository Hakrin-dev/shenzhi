import { AppShell } from "@/components/layout/app-shell";
import { AskStage } from "@/components/features/agent/ask-stage";
import type { ChatModelId, ChatReplyMode } from "@/types/ai-search";

const MODES: ChatReplyMode[] = ["fast", "deep", "idea", "doubt"];
const MODELS: ChatModelId[] = ["default", "subscription", "byok"];

function asMode(v?: string): ChatReplyMode | undefined {
  return MODES.find((m) => m === v);
}

function asModel(v?: string): ChatModelId | undefined {
  return MODELS.find((m) => m === v);
}

/** 首页「问 AI」：按正式会话接口建会话并拉流，不改原 `/agents` */
export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    mode?: string;
    model?: string;
    web_search?: string;
  }>;
}) {
  const { q = "", mode, model, web_search } = await searchParams;

  return (
    <AppShell>
      <AskStage
        question={q}
        initialMode={asMode(mode)}
        initialModel={asModel(model)}
        initialWebSearch={web_search === "1"}
      />
    </AppShell>
  );
}
