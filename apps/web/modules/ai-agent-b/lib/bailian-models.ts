/**
 * 百炼控制台「已开启免费额度」模型目录（OpenAI 兼容 model Code）
 * 与 DeepSeek 官方 API（deepseek-chat / deepseek-reasoner）分离。
 */
import type { SearchModelOption } from "@b/types/ai-search";

type CatalogEntry = Omit<SearchModelOption, "enabled">;

/** DeepSeek 官方 API 独占模型 id（勿与百炼 deepseek-v* 混淆） */
export const DEEPSEEK_OFFICIAL_MODEL_IDS = new Set([
  "deepseek-chat",
  "deepseek-reasoner",
]);

export const BAILIAN_MODEL_CATALOG: CatalogEntry[] = [
  // —— 截图高亮 / 新一代 ——
  {
    value: "qwen3.8-max",
    label: "Qwen 3.8 Max",
    provider: "qwen",
    description: "百炼免费额度 · 旗舰",
  },
  {
    value: "qwen3.8-2.4t-a95b",
    label: "Qwen 3.8 2.4T",
    provider: "qwen",
    description: "百炼免费额度 · 超大参数",
  },
  {
    value: "qwen3.7-plus-2026-05-26",
    label: "Qwen 3.7 Plus",
    provider: "qwen",
    description: "百炼免费额度 · 均衡",
  },
  {
    value: "qwen3.7-plus",
    label: "Qwen 3.7 Plus",
    provider: "qwen",
    description: "百炼免费额度",
  },
  {
    value: "qwen3.7-flash",
    label: "Qwen 3.7 Flash",
    provider: "qwen",
    description: "百炼免费额度 · 低延迟",
  },
  {
    value: "qwen3.7-max-2026-06-08",
    label: "Qwen 3.7 Max",
    provider: "qwen",
    description: "百炼免费额度 · 强推理",
  },
  // —— 经典通义 ——
  {
    value: "qwen-max",
    label: "通义千问 Max",
    provider: "qwen",
    description: "百炼免费额度 · 旗舰",
  },
  {
    value: "qwen-plus",
    label: "通义千问 Plus",
    provider: "qwen",
    description: "百炼免费额度 · 均衡",
  },
  {
    value: "qwen-turbo",
    label: "通义千问 Turbo",
    provider: "qwen",
    description: "百炼免费额度 · 快速",
  },
  {
    value: "qwen-flash",
    label: "通义千问 Flash",
    provider: "qwen",
    description: "百炼免费额度 · 超低延迟",
  },
  {
    value: "qwen-long",
    label: "通义千问 Long",
    provider: "qwen",
    description: "百炼 · 长上下文",
  },
  {
    value: "qwen-max-longcontext",
    label: "通义 Max 长上下文",
    provider: "qwen",
    description: "百炼免费额度 · 长文档",
  },
  {
    value: "qwen1.5-110b",
    label: "Qwen 1.5 110B",
    provider: "qwen",
    description: "百炼免费额度 · 开源大参",
  },
  // —— 百炼托管 DeepSeek（非官方 API）——
  {
    value: "deepseek-v3",
    label: "DeepSeek V3（百炼）",
    provider: "deepseek",
    description: "百炼免费额度 · 非 DeepSeek 官方 Key",
  },
  {
    value: "deepseek-v4-flash-0731",
    label: "DeepSeek V4 Flash（百炼）",
    provider: "deepseek",
    description: "百炼免费额度 · 低延迟",
  },
  // —— 第三方（百炼直供）——
  {
    value: "kimi-k3",
    label: "Kimi K3",
    provider: "platform",
    description: "百炼免费额度 · Moonshot",
  },
  {
    value: "kimi-k2.7-code",
    label: "Kimi K2.7 Code",
    provider: "platform",
    description: "百炼免费额度 · 代码",
  },
  {
    value: "glm-5.2",
    label: "GLM 5.2",
    provider: "zhipu",
    description: "百炼免费额度 · 智谱",
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

/** 是否应走百炼 DashScope（含 qwen/kimi 前缀及 catalog 内 id） */
export function isBailianModel(model: string): boolean {
  const id = model.trim();
  if (BAILIAN_MODEL_ID_SET.has(id)) return true;
  if (/^qwen/i.test(id)) return true;
  if (/^kimi/i.test(id)) return true;
  // 百炼版 DeepSeek：deepseek-v3、deepseek-v4-* 等，排除官方 chat/reasoner
  if (/^deepseek-v/i.test(id)) return true;
  if (id === "deepseek-v3") return true;
  return false;
}

export function isDeepSeekOfficialModel(model: string): boolean {
  return DEEPSEEK_OFFICIAL_MODEL_IDS.has(model.trim());
}
