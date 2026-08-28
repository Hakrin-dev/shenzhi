export {
  saveAskDraft,
  clearAskDraft,
  askQueryString,
  asMode,
  asModel,
  asWebSearch,
  toAAttachment,
  toBAttachment,
  readComposerDraft as readAskDraft,
  type AskDraft,
  type LegacyChatAttachment,
} from "@/lib/ask/draft";

export type {
  EntryMode,
  ChatReplyMode,
  ChatModelId,
  ChatAttachment,
} from "@/types/ai-search";
