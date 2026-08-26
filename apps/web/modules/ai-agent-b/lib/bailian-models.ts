/**
 * 百炼控制台「已开启免费额度」模型目录（与控制台截图一致，仅此 14 个）。
 * 配置 DASHSCOPE_API_KEY 后前端全部可选；不在此列表的模型不展示。
 */
import type { SearchModelOption } from "@/types/ai-search";

type CatalogEntry = Omit<SearchModelOption, "enabled">;

/** DeepSeek 官方 API 独占模型 id（勿与百炼 deepseek-v* 混淆） */
export const DEEPSEEK_OFFICIAL_MODEL_IDS = new Set([
  "deepseek-chat",
  "deepseek-reasoner",
]);

/** 百炼默认模型（.env DASHSCOPE_DEFAULT_MODEL / AI_DEFAULT_MODEL 应对齐此 id） */
export const DEFAULT_BAILIAN_MODEL = "qwen3.8-max";

/** 控制台截图中已开启免费额度的百炼模型（图 1 共 4 + 图 2 共 10 = 14） */
export const BAILIAN_MODEL_CATALOG: CatalogEntry[] = [
  {
    value: "deepseek-v4-pro-0813",
    label: "DeepSeek V4 Pro",
    provider: "deepseek",
    description: "百炼免费额度 · 982,982 / 1,000,000",
  },
  {
    value: "qwen3.7-plus-2026-05-26",
    label: "通义千问 3.7 Plus",
    provider: "qwen",
    description: "百炼免费额度 · 1,000,000 / 1,000,000",
  },
  {
    value: "qwen3.8-2.4t-a95b",
    label: "通义千问 3.8 2.4T",
    provider: "qwen",
    description: "百炼免费额度 · 1,000,000 / 1,000,000",
  },
  {
    value: "qwen3.8-max",
    label: "通义千问 3.8 Max",
    provider: "qwen",
    description: "百炼免费额度 · 999,431 / 1,000,000",
  },
  {
    value: "qwen3.8-27b",
    label: "通义千问 3.8 27B",
    provider: "qwen",
    description: "百炼免费额度 · 1,000,000 / 1,000,000",
  },
  {
    value: "qwen3.7-flash-2026-07-15",
    label: "通义千问 3.7 Flash",
    provider: "qwen",
    description: "百炼免费额度 · 1,000,000 / 1,000,000",
  },
  {
    value: "kimi-k3",
    label: "Kimi K3",
    provider: "platform",
    description: "百炼免费额度 · 997,194 / 1,000,000",
  },
  {
    value: "qwen3.7-plus",
    label: "通义千问 3.7 Plus（通用）",
    provider: "qwen",
    description: "百炼免费额度 · 1,000,000 / 1,000,000",
  },
  {
    value: "qwen3.5-ocr",
    label: "通义千问 3.5 OCR",
    provider: "qwen",
    description: "百炼免费额度 · 1,000,000 / 1,000,000",
  },
  {
    value: "qwen3.7-flash",
    label: "通义千问 3.7 Flash（通用）",
    provider: "qwen",
    description: "百炼免费额度 · 1,000,000 / 1,000,000",
  },
  {
    value: "qwen3.7-max-2026-06-08",
    label: "通义千问 3.7 Max",
    provider: "qwen",
    description: "百炼免费额度 · 1,000,000 / 1,000,000",
  },
  {
    value: "deepseek-v4-flash-0731",
    label: "DeepSeek V4 Flash",
    provider: "deepseek",
    description: "百炼免费额度 · 985,491 / 1,000,000",
  },
  {
    value: "glm-5.2",
    label: "GLM 5.2",
    provider: "zhipu",
    description: "百炼免费额度 · 999,985 / 1,000,000",
  },
  {
    value: "kimi-k2.7-code",
    label: "Kimi K2.7 Code",
    provider: "platform",
    description: "百炼免费额度 · 1,000,000 / 1,000,000",
  },
];

export const DEEPSEEK_OFFICIAL_CATALOG: CatalogEntry[] = [
  {
    value: "deepseek-chat",
    label: "DeepSeek V3（官方）",
    provider: "deepseek",
    description: "DeepSeek 官方 API · deepseek-chat",
  },
  {
    value: "deepseek-reasoner",
    label: "DeepSeek R1（官方）",
    provider: "deepseek",
    description: "DeepSeek 官方 API · 推理",
  },
];

const BAILIAN_MODEL_ID_SET = new Set(
  BAILIAN_MODEL_CATALOG.map((m) => m.value),
);

/** 是否应走百炼 DashScope（仅 catalog 内 id） */
export function isBailianModel(model: string): boolean {
  return BAILIAN_MODEL_ID_SET.has(model.trim());
}

export function isDeepSeekOfficialModel(model: string): boolean {
  return DEEPSEEK_OFFICIAL_MODEL_IDS.has(model.trim());
}
