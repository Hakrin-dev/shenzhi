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
} from "@b/types";
import { MAX_PARSE_CHARS_TOTAL } from "@/lib/constants";

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

/** 多附件聚合告警结构（思考面板可直接渲染） */
export interface AttachmentAggregationWarning {
  /** 机器可读码 */
  code: "ATTACHMENT_TRUNCATED_30K" | "ATTACHMENT_OVERALL_TRUNCATED_60K";
  /** 中文可读文案 */
  message: string;
  /** 受影响的附件名（便于用户定位） */
  files?: string[];
}

/**
 * 把附件文本拼接到系统上下文中（供 PDF 问答）
 *
 * 【硬截断规则（第二阶段 P1 新增）】
 *   1. 单附件：parseDocument 阶段已按 3 万字截断（ATTACHMENT_TRUNCATED_30K）
 *   2. 多附件聚合：所有附件正文合计 ≤ 6 万字；超出部分按顺序从前到后丢弃
 *      并返回 ATTACHMENT_OVERALL_TRUNCATED_60K 告警（思考面板展示）
 *
 * 返回：{ context, warnings }：
 *   - context：拼好的文本块（可直接追加 system prompt）
 *   - warnings：[] 或 [单条/多条告警，供思考面板 step/warning 卡]
 */
export function buildAttachmentContext(attachments: ChatAttachment[]): {
  context: string;
  warnings: AttachmentAggregationWarning[];
} {
  const valid = attachments.filter(
    (a): a is ChatAttachment & { text: string } => Boolean(a.text && !a.error),
  );
  const warnings: AttachmentAggregationWarning[] = [];
  if (valid.length === 0) return { context: "", warnings };

  // ① 先把每个附件正文 + header 一起算入 budget（header [附件 xxx]\n 也要算，避免 6 万溢出）
  let budgetUsed = 0;
  const accepted: string[] = [];
  const truncatedPerFileFiles: string[] = [];

  for (const a of valid) {
    const header = `[附件 ${a.name}]\n`;
    const body = a.text;
    const cost = header.length + body.length;

    // 超预算 → 不放入
    if (budgetUsed + cost > MAX_PARSE_CHARS_TOTAL) continue;

    accepted.push(header + body);
    budgetUsed += cost;

    // 单附件是否被截断（来自 uploads route 返回的 warningCode）
    if ((a as any).warningCode === "ATTACHMENT_TRUNCATED_30K") {
      truncatedPerFileFiles.push(a.name);
    }
  }

  // ② 单附件告警 → 聚合一条（去重文件列表）
  if (truncatedPerFileFiles.length > 0) {
    warnings.push({
      code: "ATTACHMENT_TRUNCATED_30K",
      message: `以下 ${truncatedPerFileFiles.length} 个附件超出单附件 3 万字上限，已截断：${truncatedPerFileFiles.join("、")}`,
      files: truncatedPerFileFiles,
    });
  }

  // ③ 是否有附件因总预算不足被丢弃？
  if (accepted.length < valid.length) {
    const dropped = valid
      .slice(accepted.length)
      .map((a) => a.name);
    warnings.push({
      code: "ATTACHMENT_OVERALL_TRUNCATED_60K",
      message: `多附件总字数超过上限（${MAX_PARSE_CHARS_TOTAL.toLocaleString()} 字），以下附件未被注入上下文：${dropped.join("、")}。建议一次只上传 1~2 个核心附件。`,
      files: dropped,
    });
  }

  if (accepted.length === 0) return { context: "", warnings };
  const context = `\n\n===== 以下为用户上传附件解析内容，请优先结合这些内容回答 =====\n${accepted.join(
    "\n\n",
  )}\n===== 附件内容结束 =====\n`;
  return { context, warnings };
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
 * 构造最终发送给模型的 messages 数组 + 返回附件聚合告警（思考面板可直接渲染）。
 * 约定：首条为 system（风格 + 附件 + 联网上下文），
 *       后面是对话历史，最后一条为当前用户提问。
 */
export function buildModelMessages(options: {
  style: ChatStyle;
  history: ChatMessage[];
  attachments?: ChatAttachment[];
  webSearchSources?: ChatSource[];
}): {
  messages: ChatMessage[];
  attachmentWarnings: AttachmentAggregationWarning[];
} {
  const { style, history, attachments = [], webSearchSources = [] } = options;

  let systemContent = STYLE_PROMPTS[style];
  const { context: attachmentCtx, warnings: attachmentWarnings } =
    buildAttachmentContext(attachments);
  const webCtx = buildWebSearchContext(webSearchSources);
  if (attachmentCtx || webCtx) {
    systemContent += attachmentCtx + webCtx;
  }

  const messages: ChatMessage[] = [{ role: "system", content: systemContent }];
  // 追加多轮历史（已包含 user/assistant 对话）
  for (const m of history) messages.push(m);
  return { messages, attachmentWarnings };
}
