/**
 * 向 DashScope OpenAI 兼容接口探测百炼模型是否可调用（含免费额度校验）
 * GET /api/v1/models 不返回额度信息，故用最小 chat/completions 请求验证。
 */
import { BAILIAN_MODEL_CATALOG } from "@b/lib/bailian-models";

export interface ModelProbeResult {
  model: string;
  ok: boolean;
  status?: number;
  message?: string;
}

const PROBE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; results: Map<string, ModelProbeResult> } | null =
  null;

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
  return { apiKey, baseUrl };
}

async function probeOne(
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<ModelProbeResult> {
  const url = `${baseUrl}/chat/completions`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
      cache: "no-store",
    });
    if (res.ok) {
      return { model, ok: true, status: res.status };
    }
    let message = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      message = j?.error?.message || message;
    } catch {
      /* ignore */
    }
    return { model, ok: false, status: res.status, message };
  } catch (e) {
    return {
      model,
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

/** 并行探测 catalog 内所有百炼模型（5 分钟内存缓存） */
export async function probeBailianCatalog(): Promise<
  Map<string, ModelProbeResult>
> {
  const now = Date.now();
  if (cache && now - cache.at < PROBE_TTL_MS) {
    return cache.results;
  }

  const runtime = dashscopeRuntime();
  const results = new Map<string, ModelProbeResult>();

  if (!runtime) {
    for (const m of BAILIAN_MODEL_CATALOG) {
      results.set(m.value, {
        model: m.value,
        ok: false,
        message: "未配置 DASHSCOPE_API_KEY",
      });
    }
    cache = { at: now, results };
    return results;
  }

  const probes = await Promise.all(
    BAILIAN_MODEL_CATALOG.map((m) =>
      probeOne(m.value, runtime.apiKey, runtime.baseUrl),
    ),
  );
  for (const p of probes) {
    results.set(p.model, p);
  }
  cache = { at: now, results };
  return results;
}

/** 开发脚本用：打印探测结果 */
export async function logBailianProbeReport(): Promise<void> {
  const results = await probeBailianCatalog();
  const ok: string[] = [];
  const fail: ModelProbeResult[] = [];
  for (const r of results.values()) {
    if (r.ok) ok.push(r.model);
    else fail.push(r);
  }
  console.log("=== 百炼模型 API 探测 ===");
  console.log("可用:", ok.length ? ok.join(", ") : "(无)");
  for (const f of fail) {
    console.log(`不可用 ${f.model}: ${f.message ?? "unknown"}`);
  }
}
