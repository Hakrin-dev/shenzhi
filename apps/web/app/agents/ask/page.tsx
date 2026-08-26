import { AskPage } from "@/features/chat/ask/AskPage";
import { normalizeChatModelId } from "@/lib/data/chat-models";
import type { ChatReplyMode } from "@/types/ai-search";

const MODES: ChatReplyMode[] = ["fast", "deep", "idea", "doubt"];

function asMode(value?: string) {
  return MODES.find((mode) => mode === value);
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
      initialModel={normalizeChatModelId(model)}
      initialWebSearch={web_search === "1"}
    />
  );
}
