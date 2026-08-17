/**
 * B 模块 —— Prompt 拼接 & 4 种回复风格的 System Prompt
 *
 * 【2026-08-17 对齐 A 模块契约】
 *   对外：ChatStyle（B UI 命名） = fast | deep | inspire | question
 *   对内：A 协议 ChatReplyMode     = fast | deep | idea    | doubt
 *   本文件 STYLE_PROMPTS 的 key 统一使用 B 层 ChatStyle，
 *   实际发送前 lib/api/search.ts 会把 inspire → idea、question → doubt。
 *   System Prompt 文案与 A 模块保持一致（灵感 = idea，质疑 = doubt）。
 */

import type {
  ChatAttachment,
  ChatMessage,
  ChatSource,
  ChatStyle,
} from "@/types";

export const STYLE_PROMPTS: Record<ChatStyle, string> = {
  fast:
    "你是「深知」科研助手（快速回复）。请用简洁、凝练的语言回答用户问题，优先给出结论性要点，控制在 3~5 句，避免长文铺垫。",
  deep:
    "你是「深知」科研助手（深度分析）。请围绕用户问题进行系统性深入回答，按背景—方法—对比—结论分点展开，引用时请标注来源序号 [n]，必要时给出数据或性能对比表格。",
  // A: idea = 灵感启发
  inspire:
    "你是「深知」科研助手（灵感激发）。请基于用户问题给出具有启发性的发散性思考，可涵盖：① 未来研究方向；② 跨领域迁移思路；③ 待解决开放问题；④ 实验可落地假设。多用『或许可以…』『值得尝试…』等句式鼓励探索。",
  // A: doubt = 质疑批判
  question:
    "你是「深知」科研助手（质疑视角）。请以批判视角审视用户问题，从以下维度提出明确质疑点：① 前提假设是否成立；② 方法/方案的局限与适用边界；③ 证据链是否完备、是否遗漏对立工作；④ 反例与边界条件；⑤ 复现风险或落地隐患；最后给出更严谨的替代方案。",
};

/** 把附件文本拼接到系统上下文中（供 PDF 问答） */
export function buildAttachmentContext(attachments: ChatAttachment[]): string {
  const valid = attachments.filter((a) => a.text && !a.error);
  if (valid.length === 0) return "";
  const blocks = valid.map((a) => {
    return `[附件 ${a.name}]\n${a.text}`;
  });
  return `\n\n===== 以下为用户上传附件解析内容，请优先结合这些内容回答 =====\n${blocks.join(
    "\n\n",
  )}\n===== 附件内容结束 =====\n`;
}

/** 把联网搜索结果拼接到系统上下文中 */
export function buildWebSearchContext(sources: ChatSource[]): string {
  if (sources.length === 0) return "";
  const lines = sources.map(
    (s) =>
      `[${s.id}] ${s.title}${s.venue ? ` (${s.venue})` : ""}${s.url ? ` - URL:${s.url}` : ""}`,
  );
  return `\n\n===== 联网搜索结果（请整合并在文中引用 [n]） =====\n${lines.join(
    "\n",
  )}\n===== 搜索结果结束 =====\n`;
}

/**
 * 构造最终发送给模型的 messages 数组。
 * 约定：首条为 system（风格 + 附件 + 联网上下文），
 *       后面是对话历史，最后一条为当前用户提问。
 */
export function buildModelMessages(options: {
  style: ChatStyle;
  history: ChatMessage[];
  attachments?: ChatAttachment[];
  webSearchSources?: ChatSource[];
}): ChatMessage[] {
  const { style, history, attachments = [], webSearchSources = [] } = options;

  let systemContent = STYLE_PROMPTS[style];
  const attachmentCtx = buildAttachmentContext(attachments);
  const webCtx = buildWebSearchContext(webSearchSources);
  if (attachmentCtx || webCtx) {
    systemContent += attachmentCtx + webCtx;
  }

  const next: ChatMessage[] = [{ role: "system", content: systemContent }];
  // 追加多轮历史（已包含 user/assistant 对话）
  for (const m of history) next.push(m);
  return next;
}
