import { createChatSession, sendChatMessage } from "../../../clients/backend/chat";
import type {
  ChatCapabilities,
  ChatSessionDetail,
  ComposerSubmitPayload,
} from "../../../types/ai-search";
import type { ComposerEntryMode } from "../../../types";
import type { ChatSendInput, ChatTurn } from "../types";

/** Session/message orchestration; HTTP/SSE stays in clients/backend. */
export function beginTurn(sessionId: string | null, input: ChatSendInput) {
  return sessionId
    ? sendChatMessage(sessionId, input)
    : createChatSession({ type: "chat", ...input });
}

/** UI-only adapter: the Chat domain receives the nested capability contract. */
export function capabilitiesForEntryMode(entryMode: ComposerEntryMode): ChatCapabilities {
  return { knowledge: { enabled: entryMode === "ai" } };
}

export function chatInputFromComposer(payload: ComposerSubmitPayload): ChatSendInput {
  const { entryMode, ...input } = payload;
  return { ...input, capabilities: capabilitiesForEntryMode(entryMode) };
}

export function restoreTurns(session: ChatSessionDetail): ChatTurn[] {
  return session.messages.flatMap((message) => {
    const base = { reasoning: "", thought: "", references: [], followups: [], warnings: [] };
    return [
      { ...base, localId: `${message.id}-user`, role: "user", content: message.question, status: "done" },
      { ...base, localId: message.id, role: "assistant", messageId: message.id,
        content: message.content, reasoning: message.reasoning, status: message.status,
        references: message.references ?? [], readCount: (message.references ?? []).length,
        followups: message.followups ?? [], warnings: message.warnings ?? [],
        durationMs: message.duration_ms, error: message.error ?? undefined },
    ];
  });
}
