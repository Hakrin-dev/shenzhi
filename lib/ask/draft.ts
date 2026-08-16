import type {
  ChatAttachment,
  ChatModelId,
  ChatReplyMode,
  ComposerSubmitPayload,
} from "@/types/ai-search";

const KEY = "shenzhi.chat.draft";

export interface AskDraft {
  question: string;
  mode: ChatReplyMode;
  model: ChatModelId;
  web_search: boolean;
  attachments: ChatAttachment[];
}

const DEFAULTS: Omit<AskDraft, "question"> = {
  mode: "fast",
  model: "default",
  web_search: false,
  attachments: [],
};

export function saveAskDraft(payload: ComposerSubmitPayload) {
  if (typeof window === "undefined") return;
  const draft: AskDraft = {
    question: payload.question,
    mode: payload.mode,
    model: payload.model,
    web_search: payload.web_search,
    attachments: payload.attachments,
  };
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function readAskDraft(question: string): AskDraft {
  const fallback: AskDraft = { question, ...DEFAULTS };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AskDraft>;
    const sameQuestion =
      !parsed.question || parsed.question === question || !question;
    return {
      question: question || parsed.question || "",
      mode: sameQuestion && parsed.mode ? parsed.mode : DEFAULTS.mode,
      model: sameQuestion && parsed.model ? parsed.model : DEFAULTS.model,
      web_search:
        sameQuestion && typeof parsed.web_search === "boolean"
          ? parsed.web_search
          : DEFAULTS.web_search,
      attachments:
        sameQuestion && Array.isArray(parsed.attachments)
          ? parsed.attachments
          : [],
    };
  } catch {
    return fallback;
  }
}

export function clearAskDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}

export function askQueryString(payload: ComposerSubmitPayload) {
  const params = new URLSearchParams({
    q: payload.question,
    mode: payload.mode,
    model: payload.model,
    web_search: payload.web_search ? "1" : "0",
  });
  return params.toString();
}
