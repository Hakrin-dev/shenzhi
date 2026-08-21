/**
 * A ↔ B 草稿传递通道：
 *   - A 模块 search-hero 点击「问 AI」时，先写 sessionStorage 再跳转 /agents/ask
 *   - B 模块 AgentChat 初始化时读取草稿，恢复 attachments / mode / model / web_search
 *
 * 约定 key：shenzhi.chat.draft
 * 匹配规则：读取草稿时，若 URL 中 ?q= 与草稿 question 不一致，则丢弃草稿（视为跨对话）
 */

import type {
  ChatAttachment,
  ChatModelId,
  ChatReplyMode,
  ComposerSubmitPayload,
  EntryMode,
} from "@/types/ai-search";

const DRAFT_KEY = "shenzhi.chat.draft";

/** A 模块写入草稿（search-hero 在 router.push 前调用） */
export function saveAskDraft(payload: ComposerSubmitPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch (e) {
    // 隐私模式 / storage 超限 → 静默降级，URL 参数至少能恢复 q/mode/model/web_search
    console.warn("[draft] saveAskDraft failed:", (e as Error).message);
  }
}

/**
 * B 模块读取草稿（AgentChat 初始化时调用）。
 * @param question URL 中解析出的当前 question，用于与草稿匹配校验
 * @returns 匹配时返回完整 payload；不匹配 / 没有草稿时返回 null
 */
export function readAskDraft(question: string | null): ComposerSubmitPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as ComposerSubmitPayload;
    // 严格匹配：草稿问题必须与 URL 的 question 一致才使用
    // （null/空问题时不校验，允许用户直接打开 /agents/ask 不带 q 的场景读取残留草稿）
    if (question !== null && question !== "" && payload.question !== question) {
      return null;
    }
    return payload;
  } catch (e) {
    console.warn("[draft] readAskDraft failed:", (e as Error).message);
    return null;
  }
}

/** 清空草稿（发送成功后调用，避免下次复用） */
export function clearAskDraft(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * A 模块构造 /agents/ask?xxx 的 query string（严格对齐 A 实现）。
 * B 模块解析 URL 参数时必须使用相同字段名：
 *   q          问题
 *   mode       fast | deep | idea | doubt
 *   model      default | subscription | byok
 *   web_search "1" 开启 / "0" 关闭
 */
export function askQueryString(payload: ComposerSubmitPayload): string {
  const params = new URLSearchParams({
    q: payload.question,
    mode: payload.mode,
    model: String(payload.model),
    web_search: payload.web_search ? "1" : "0",
  });
  return params.toString();
}

/* ---------- 合法值校验（A 模块实现：asMode / asModel） ---------- */

const VALID_MODES: ChatReplyMode[] = ["fast", "deep", "idea", "doubt"];
const VALID_MODELS: ChatModelId[] = ["default", "subscription", "byok"];

export function asMode(raw: string | null | undefined): ChatReplyMode {
  if (!raw) return "fast";
  return (VALID_MODES as string[]).includes(raw)
    ? (raw as ChatReplyMode)
    : "fast";
}

export function asModel(raw: string | null | undefined): string {
  if (!raw) return "default";
  // A 模块对 model 宽松：合法 3 档用 ChatModelId，其他字符串（如 gpt-4o）直接透传
  if ((VALID_MODELS as string[]).includes(raw)) return raw;
  return raw;
}

export function asWebSearch(raw: string | null | undefined): boolean {
  return raw === "1" || raw === "true";
}

/* ---------- 类型辅助：B 旧附件 → A 新附件的转换 ---------- */

import type { ChatAttachment as BChatAttachment } from "@/types";

/**
 * 把 B 模块旧的 ChatAttachment（{ id, name, type, size, text, error }）
 * 转成 A 模块标准 ChatAttachment（{ kind, file_id?, ref_id?, title? }）。
 *
 * 这是发送时的适配层，避免 C 模块代码改动太剧烈。
 * kind 映射规则：
 *   pdf/txt/md/other → kind: "file", file_id: B.id
 *   其他引用类型 → kind: "paper"，ref_id: B.id（C 接入后应精确匹配 kind 枚举）
 */
export function toAAttachment(
  atts: BChatAttachment[],
): ChatAttachment[] {
  return atts.map((a) => {
    // 如果有 ref_id/kind 就按真实 A 类型（C 写入的场景）；否则退化为 file 类型
    const legacy = a as unknown as { kind?: ChatAttachment["kind"]; ref_id?: string };
    if (legacy.kind) {
      return {
        kind: legacy.kind,
        file_id: legacy.kind === "file" ? a.id : undefined,
        ref_id: legacy.ref_id ?? (legacy.kind !== "file" ? a.id : undefined),
        title: a.name,
      };
    }
    return {
      kind: "file",
      file_id: a.id,
      title: a.name,
    };
  });
}

/**
 * 反向：A ChatAttachment → B ChatAttachment（composer 显示附件 chips 时使用）。
 * UPDATE: 2026-08-20 C1 附件解析贯通 —— 草稿里的 A 格式附件如果携带了扩展字段
 *   {text, error, size, type}（例如 C 模块上传后再次 saveAskDraft 会把 B 扩展字段带回来），
 *   则在此透传到 B 格式；避免 A→B 页面跳转后附件 text/error 丢失，
 *   导致 buildAttachmentContext 过滤为空、AI 读不到附件正文。
 *   type 映射优先级：A 自带扩展 type > 从 kind 推断 > 默认 md
 */
export function toBAttachment(
  atts: ChatAttachment[],
): BChatAttachment[] {
  return atts.map((a, idx) => {
    const ext = a as unknown as {
      text?: string;
      error?: string;
      size?: number;
      type?: "pdf" | "txt" | "md" | "other";
    };
    const inferredType: BChatAttachment["type"] =
      ext.type ??
      (a.kind === "file"
        ? /\.(pdf)$/i.test(a.title ?? "")
          ? "pdf"
          : /\.(txt)$/i.test(a.title ?? "")
            ? "txt"
            : /\.(md|markdown)$/i.test(a.title ?? "")
              ? "md"
              : "other"
        : "md");
    return {
      id: a.file_id ?? a.ref_id ?? `att_draft_${idx}`,
      name: a.title ?? `附件 ${idx + 1}`,
      type: inferredType,
      // 草稿恢复时透传：size / text / error
      size: ext.size,
      text: ext.text,
      error: ext.error,
      // 同步把 A 原生 kind/ref_id 带过去（保证 toAAttachment 再转换时不丢信息）
      kind: a.kind,
      ref_id: a.ref_id,
    };
  });
}

/* ---------- EntryMode / Mode 等类型兜底导出（A 模块消费用） ---------- */

export type { EntryMode, ChatReplyMode, ChatModelId, ChatAttachment };
