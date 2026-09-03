import { AskPage } from "@/features/chat/ask/AskPage";
import { normalizeAskSessionId } from "@/features/chat/services/session-url";
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
    session?: string;
  }>;
}) {
  const { q = "", mode, model, web_search, session } = await searchParams;
  const initialSessionId = normalizeAskSessionId(session);
  const invalidSession = session !== undefined && initialSessionId === null;

  return (
    <AskPage
      question={q}
      initialMode={asMode(mode)}
      initialModel={model}
      initialWebSearch={web_search === undefined ? undefined : web_search === "1"}
      initialSessionId={initialSessionId}
      invalidSession={invalidSession}
    />
  );
}
