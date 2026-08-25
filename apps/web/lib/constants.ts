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

/** B 模块附件解析上限（与 feat/ai-agent-B lib/constants 一致） */
export const MAX_PARSE_CHARS_PER_FILE = 30_000;
export const MAX_PARSE_CHARS_TOTAL = 60_000;
