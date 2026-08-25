/** 全局常量 —— 与原型设计稿对齐 */

export const SITE = {
  name: "深知",
  fullName: "ShenZhi · Research OS",
  user: {
    name: "未登录",
    title: "",
  },
} as const;

/** 侧边栏导航槽位(与 SVG 原型的 44px 间距一致) */
export const NAV_SECTIONS = {
  research: "研究",
  explore: "探索",
} as const;

/* ================================================================
 * 附件解析 / Prompt 截断常量
 * ----------------------------------------------------------------
 * UPDATE: 2026-08-21 P1 Build 修复
 *  把 MAX_PARSE_CHARS_* 从 lib/c-server/parse-document.ts（Node-only）抽出来，
 *  避免 client 端 chat-prompt → parse-document → pdf-parse → node:fs 的跨边界导入。
 * ================================================================ */

/** 单附件硬截断（防止单个 PDF 几百页塞满上下文） */
export const MAX_PARSE_CHARS_PER_FILE = 30_000;

/** 多附件聚合硬截断（再做一次 Prompt 级保护） */
export const MAX_PARSE_CHARS_TOTAL = 60_000;
