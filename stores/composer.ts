"use client";

/**
 * B 模块 —— Composer 全局共享状态（Zustand）
 *
 * 这是 A / B / C 三人协作的「数据总线」：
 *   - A 模块：读取 mode、message，写路由跳转
 *   - B 模块：读取 model / style / webSearch / attachments，构造 ChatRequest
 *   - C 模块：写 webSearch、写 attachments（上传解析后），提供 webSearchFn 给 B 调用
 *
 * 任何人 set 字段，另外两方通过 useComposerStore() 立即同步。
 */

import { create } from "zustand";
import type {
  ChatAttachment,
  ChatMode,
  ChatSource,
  ChatStyle,
} from "@/types";

/**
 * 模型下拉选项（B 模块前端可选列表）。
 * 注意：A 模块 search-hero 传过来的 model 参数只可能是
 *   "default" | "subscription" | "byok"
 * 这三个之一。B 的 Composer 仍保留完整模型名（历史遗留），
 * 发送时如果是这三档特殊字符串会原样透传，否则也透传。
 */
export const MODEL_OPTIONS: { id: string; label: string }[] = [
  { id: "default", label: "默认模型（推荐）" },
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "deepseek-v3", label: "DeepSeek-V3" },
  { id: "subscription", label: "订阅专属模型" },
  { id: "byok", label: "API 接入模型" },
];

/**
 * 4 种回复风格选项 —— 与 A 模块文案完全对齐：
 *   fast     → 快速（简洁凝练）
 *   deep     → 深度（系统分析）
 *   inspire  → 灵感（对应 A 协议 idea，发散研究方向）
 *   question → 质疑（对应 A 协议 doubt，提出批判视角）
 * UI 层仍然显示旧 B 文案（让用户认知一致），实际发送前通过 mapToAMode 转换。
 */
export const STYLE_OPTIONS: {
  value: ChatStyle;
  label: string;
  desc: string;
}[] = [
  {
    value: "fast",
    label: "快速",
    desc: "简洁凝练，优先给出结论要点（3~5 句）",
  },
  {
    value: "deep",
    label: "深度",
    desc: "分点系统分析，附带数据/对比与结论建议",
  },
  {
    value: "inspire",
    label: "灵感",
    desc: "发散研究方向、跨域迁移思路，鼓励探索",
  },
  {
    value: "question",
    label: "质疑",
    desc: "批判反方视角，指出前提局限与复现风险",
  },
];

export interface ComposerState {
  /* ---- A / B / C 共享字段 ---- */
  mode: ChatMode;
  message: string;
  model: string;
  style: ChatStyle;
  /** C 模块写：联网搜索开关状态 */
  webSearch: boolean;
  /** C 模块写：附件解析结果（含失败信息） */
  attachments: ChatAttachment[];

  /* ---- C 模块可选注入：联网搜索函数，B 请求前置调用 ---- */
  /** (query) => Promise<sources[]>；未注入（C 未开发完）时，B 自动跳过联网步骤 */
  webSearchFn: ((query: string) => Promise<ChatSource[]>) | null;

  /* ---- actions ---- */
  setMode: (m: ChatMode) => void;
  setMessage: (v: string) => void;
  setModel: (id: string) => void;
  setStyle: (s: ChatStyle) => void;
  setWebSearch: (v: boolean) => void;

  addAttachment: (a: ChatAttachment) => void;
  removeAttachment: (id: string) => void;
  updateAttachment: (id: string, patch: Partial<ChatAttachment>) => void;
  clearAttachments: () => void;

  registerWebSearchFn: (fn: ((q: string) => Promise<ChatSource[]>) | null) => void;

  /** 清空本轮输入（发送成功后调用） */
  resetDraft: () => void;
}

export const useComposerStore = create<ComposerState>((set) => ({
  mode: "ai",
  message: "",
  model: MODEL_OPTIONS[0].id,
  style: "fast",
  webSearch: false,
  attachments: [],
  webSearchFn: null,

  setMode: (m) => set({ mode: m }),
  setMessage: (v) => set({ message: v }),
  setModel: (id) => set({ model: id }),
  setStyle: (s) => set({ style: s }),
  setWebSearch: (v) => set({ webSearch: v }),

  addAttachment: (a) =>
    set((s) => ({ attachments: [...s.attachments, a] })),
  removeAttachment: (id) =>
    set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),
  updateAttachment: (id, patch) =>
    set((s) => ({
      attachments: s.attachments.map((a) =>
        a.id === id ? { ...a, ...patch } : a,
      ),
    })),
  clearAttachments: () => set({ attachments: [] }),

  registerWebSearchFn: (fn) => set({ webSearchFn: fn }),

  resetDraft: () => set({ message: "" }),
}));

/** 轻量工具：生成附件 id（C 模块上传时可直接用） */
export function makeAttachmentId(): string {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
