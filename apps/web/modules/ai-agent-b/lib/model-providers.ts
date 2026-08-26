/**
 * 多 Provider 路由（服务端 only）
 *
 * - dashscope：阿里云百炼 OpenAI 兼容接口（DASHSCOPE_* / BAILIAN_*）
 * - deepseek：DeepSeek 官方 API（DEEPSEEK_*，仅 deepseek-chat / deepseek-reasoner）
 */
import {
  BAILIAN_MODEL_CATALOG,
  DEFAULT_BAILIAN_MODEL,
  DEEPSEEK_OFFICIAL_CATALOG,
  isBailianModel,
  isDeepSeekOfficialModel,
} from "@b/lib/bailian-models";
import type { SearchConfig, SearchModelOption } from "@b/types/ai-search";

export type UpstreamProvider = "dashscope" | "deepseek";

export interface ResolvedLLM {
  provider: UpstreamProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

const A_PROTOCOL_FALLBACKS = new Set(["default", "subscription", "byok"]);

function dashscopeRuntime() {
  const apiKey =
    process.env.DASHSCOPE_API_KEY?.trim() ||
    process.env.BAILIAN_API_KEY?.trim() ||
    "";
  if (!apiKey) return null;
  const baseUrl = (
    process.env.DASHSCOPE_BASE_URL?.trim() ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1"
  ).replace(/\/+$/, "");
  const defaultModel =
    process.env.DASHSCOPE_DEFAULT_MODEL?.trim() || DEFAULT_BAILIAN_MODEL;
  return { apiKey, baseUrl, defaultModel };
}

function deepseekRuntime() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() || "";
  if (!apiKey) return null;
  const baseUrl = (
    process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com/v1"
  ).replace(/\/+$/, "");
  const defaultModel = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  return { apiKey, baseUrl, defaultModel };
}

export class MissingProviderError extends Error {
  provider: UpstreamProvider | "any";
  constructor(provider: UpstreamProvider | "any", message: string) {
    super(message);
    this.name = "MissingProviderError";
    this.provider = provider;
  }
}

/** 前端 modelId → 实际上游 Provider + 模型名 */
export function resolveLLM(rawModel: string | undefined | null): ResolvedLLM {
  const model = (rawModel || "").trim();
  const dash = dashscopeRuntime();
  const deep = deepseekRuntime();

  if (!model || A_PROTOCOL_FALLBACKS.has(model)) {
    const preferred =
      process.env.AI_DEFAULT_MODEL?.trim() ||
      (dash ? dash.defaultModel : deep?.defaultModel) ||
      DEFAULT_BAILIAN_MODEL;
    return resolveLLM(preferred);
  }

  if (isDeepSeekOfficialModel(model)) {
    if (!deep) {
      throw new MissingProviderError(
        "deepseek",
        "未配置 DeepSeek 官方 API Key（DEEPSEEK_API_KEY）。",
      );
    }
    return {
      provider: "deepseek",
      apiKey: deep.apiKey,
      baseUrl: deep.baseUrl,
      model,
    };
  }

  if (isBailianModel(model)) {
    if (!dash) {
      throw new MissingProviderError(
        "dashscope",
        "未配置百炼 API Key（DASHSCOPE_API_KEY 或 BAILIAN_API_KEY）。",
      );
    }
    return {
      provider: "dashscope",
      apiKey: dash.apiKey,
      baseUrl: dash.baseUrl,
      model,
    };
  }

  if (dash) {
    return {
      provider: "dashscope",
      apiKey: dash.apiKey,
      baseUrl: dash.baseUrl,
      model: dash.defaultModel,
    };
  }
  if (deep) {
    return {
      provider: "deepseek",
      apiKey: deep.apiKey,
      baseUrl: deep.baseUrl,
      model: deep.defaultModel,
    };
  }

  throw new MissingProviderError(
    "any",
    "未配置任何模型 API Key。请设置 DASHSCOPE_API_KEY（百炼）或 DEEPSEEK_API_KEY（官方）。",
  );
}

/** 追问：优先百炼轻量模型 */
export function resolveFollowupLLM(): ResolvedLLM {
  const dash = dashscopeRuntime();
  if (dash) {
    return {
      provider: "dashscope",
      apiKey: dash.apiKey,
      baseUrl: dash.baseUrl,
      model: "qwen3.7-flash",
    };
  }
  return resolveLLM("deepseek-chat");
}

function sortModels(models: SearchModelOption[], defaultModel: string) {
  models.sort((a, b) => {
    if (a.value === defaultModel) return -1;
    if (b.value === defaultModel) return 1;
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return 0;
  });
}

/** 同步兜底（不探测 API，仅检查 Key 是否存在） */
export function buildSearchConfig(): SearchConfig {
  const dash = dashscopeRuntime();
  const deep = deepseekRuntime();

  const models: SearchModelOption[] = [
    ...BAILIAN_MODEL_CATALOG.map((m) => ({
      ...m,
      enabled: Boolean(dash),
      reason: dash ? undefined : "no_api_key",
    })),
    ...DEEPSEEK_OFFICIAL_CATALOG.map((m) => ({
      ...m,
      enabled: Boolean(deep),
      reason: deep ? undefined : "no_api_key",
    })),
  ];

  const defaultModel =
    process.env.AI_DEFAULT_MODEL?.trim() ||
    (dash ? dash.defaultModel : deep?.defaultModel) ||
    DEFAULT_BAILIAN_MODEL;

  sortModels(models, defaultModel);

  return {
    models,
    modes: ["fast", "deep", "idea", "doubt"],
    quota: { used: 0, limit: 20, deep_used: 0, deep_limit: 5 },
    upload: {
      max_size_mb: 20,
      max_files: 5,
      accept: [".pdf", ".docx", ".md", ".txt"],
    },
  };
}

export function defaultChatModelId(): string {
  const cfg = buildSearchConfig();
  return cfg.models.find((m) => m.enabled)?.value ?? DEFAULT_BAILIAN_MODEL;
}
