import type {
  ChatAttachment,
  ChatModelId,
  ChatReplyMode,
  ComposerSubmitPayload,
  EntryMode,
} from "@/types/ai-search";
import { DEFAULT_CHAT_MODEL } from "@/lib/data/chat-models";

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
  model: DEFAULT_CHAT_MODEL,
  web_search: false,
  attachments: [],
};

export function saveAskDraft(payload: ComposerSubmitPayload) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("[draft] saveAskDraft failed:", (e as Error).message);
  }
}

/** 主站 ask-stage：返回带默认值的 AskDraft */
export function readAskDraft(question: string): AskDraft {
  const fallback: AskDraft = { question, ...DEFAULTS };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ComposerSubmitPayload & AskDraft>;
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

/** B 模块 agent-chat：严格匹配 question 后返回完整 payload */
export function readComposerDraft(
  question: string | null,
): ComposerSubmitPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as ComposerSubmitPayload;
    if (
      question !== null &&
      question !== "" &&
      payload.question !== question
    ) {
      return null;
    }
    return payload;
  } catch (e) {
    console.warn("[draft] readComposerDraft failed:", (e as Error).message);
    return null;
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
    model: String(payload.model),
    web_search: payload.web_search ? "1" : "0",
  });
  return params.toString();
}

const VALID_MODES: ChatReplyMode[] = ["fast", "deep", "idea", "doubt"];
const VALID_MODELS = ["default", "subscription", "byok"] as const;

export function asMode(raw: string | null | undefined): ChatReplyMode {
  if (!raw) return "fast";
  return (VALID_MODES as string[]).includes(raw)
    ? (raw as ChatReplyMode)
    : "fast";
}

export function asModel(raw: string | null | undefined): string {
  if (!raw) return "default";
  if ((VALID_MODELS as readonly string[]).includes(raw)) return raw;
  return raw;
}

export function asWebSearch(raw: string | null | undefined): boolean {
  return raw === "1" || raw === "true";
}

/** B 模块 UI 附件（含 id/name） */
export interface LegacyChatAttachment {
  id: string;
  name: string;
  type: "pdf" | "txt" | "md" | "other";
  size?: number;
  text?: string;
  error?: string;
  kind?: ChatAttachment["kind"];
  ref_id?: string;
}

export function toAAttachment(
  atts: LegacyChatAttachment[],
): ChatAttachment[] {
  return atts.map((a) => {
    if (a.kind) {
      return {
        kind: a.kind,
        file_id: a.kind === "file" ? a.id : undefined,
        ref_id: a.ref_id ?? (a.kind !== "file" ? a.id : undefined),
        title: a.name,
        text: a.text,
        error: a.error,
        size: a.size,
        type: a.type,
      };
    }
    return {
      kind: "file",
      file_id: a.id,
      title: a.name,
      text: a.text,
      error: a.error,
      size: a.size,
      type: a.type,
    };
  });
}

export function toBAttachment(
  atts: ChatAttachment[],
): LegacyChatAttachment[] {
  return atts.map((a, idx) => {
    const inferredType: LegacyChatAttachment["type"] =
      a.type ??
      (a.kind === "file"
        ? /\.pdf$/i.test(a.title ?? "")
          ? "pdf"
          : /\.txt$/i.test(a.title ?? "")
            ? "txt"
            : /\.(md|markdown)$/i.test(a.title ?? "")
              ? "md"
              : "other"
        : "md");
    return {
      id: a.file_id ?? a.ref_id ?? `att_draft_${idx}`,
      name: a.title ?? `附件 ${idx + 1}`,
      type: inferredType,
      size: a.size,
      text: a.text,
      error: a.error,
      kind: a.kind,
      ref_id: a.ref_id,
    };
  });
}

export type { EntryMode, ChatReplyMode, ChatModelId, ChatAttachment };
