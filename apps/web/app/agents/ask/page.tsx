import { AskPage } from "@/features/agents/ask/AskPage";
import type { ChatModelId, ChatReplyMode } from "@/types/ai-search";

const MODES: ChatReplyMode[] = ["fast", "deep", "idea", "doubt"];
const MODELS: ChatModelId[] = ["default", "subscription", "byok"];

function asMode(value?: string) {
  return MODES.find((mode) => mode === value);
}

function asModel(value?: string) {
  return MODELS.find((model) => model === value);
}

export default async function Page({
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
    <AskPage
      question={q}
      initialMode={asMode(mode)}
      initialModel={asModel(model)}
      initialWebSearch={web_search === "1"}
    />
  );
}
