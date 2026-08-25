import type { ChatModelId, SearchModelOption } from "@/types/ai-search";
import {
  BAILIAN_MODEL_CATALOG,
  DEEPSEEK_OFFICIAL_CATALOG,
} from "@b/lib/bailian-models";

/** 前端兜底目录（运行时以 /api/b/search/config 为准） */
export const CHAT_MODEL_CATALOG: SearchModelOption[] = [
  ...BAILIAN_MODEL_CATALOG.map((m) => ({ ...m, enabled: true })),
  ...DEEPSEEK_OFFICIAL_CATALOG.map((m) => ({ ...m, enabled: true })),
  {
    value: "gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    enabled: false,
    reason: "not_subscribed",
    description: "OpenAI 旗舰多模态模型",
  },
  {
    value: "gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "openai",
    enabled: false,
    reason: "not_subscribed",
    description: "OpenAI 轻量快速模型",
  },
  {
    value: "claude-3-5-sonnet",
    label: "Claude 3.5 Sonnet",
    provider: "anthropic",
    enabled: false,
    reason: "not_subscribed",
    description: "Anthropic 长上下文推理",
  },
  {
    value: "gemini-2-flash",
    label: "Gemini 2.0 Flash",
    provider: "google",
    enabled: false,
    reason: "not_subscribed",
    description: "Google 低延迟模型",
  },
  {
    value: "glm-4-plus",
    label: "GLM-4 Plus",
    provider: "zhipu",
    enabled: false,
    reason: "not_subscribed",
    description: "智谱 GLM（非百炼通道）",
  },
];

export const DEFAULT_CHAT_MODEL: ChatModelId = "qwen-turbo";

export const CHAT_MODEL_IDS = CHAT_MODEL_CATALOG.map((m) => m.value);

const LEGACY_MODEL_MAP: Record<string, ChatModelId> = {
  default: "qwen-turbo",
  subscription: "gpt-4o",
  byok: "gpt-4o-mini",
};

export function normalizeChatModelId(value?: string | null): ChatModelId {
  if (!value) return DEFAULT_CHAT_MODEL;
  if (CHAT_MODEL_IDS.includes(value)) return value;
  if (value in LEGACY_MODEL_MAP) return LEGACY_MODEL_MAP[value]!;
  return DEFAULT_CHAT_MODEL;
}

export function chatModelLabel(value: ChatModelId): string {
  return (
    CHAT_MODEL_CATALOG.find((m) => m.value === value)?.label ?? value
  );
}
