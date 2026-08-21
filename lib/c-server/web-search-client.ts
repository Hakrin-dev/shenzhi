/**
 * C 模块 · 联网搜索客户端（仅在 Next.js Server Route 内调用）
 *
 * 双实现 + 自动降级：
 *   1. Tavily     —— 优先（需要 .env.local 配置 TAVILY_API_KEY，POST https://api.tavily.com/search）
 *   2. SearXNG    —— 降级（需要 .env.local 配置 SEARXNG_BASE_URL 指向自建实例，GET /search?format=json）
 *   3. 都不可用   —— 返回 []（前端联网开关点了也不会报错，B 层自动跳过联网步骤）
 *
 * 与 C1 一致的设计原则：
 *   - 服务端调用（密钥绝不进前端 bundle）
 *   - 单次搜索有 10s 超时（AbortSignal.timeout），失败打 console.warn 而不是 throw，
 *     保证「联网失败 ≠ 整个对话失败」
 *   - 对外统一返回归一化结构，由 route.ts 转成 ChatSource[] 喂给前端 / refs 事件
 */

/** 归一化的单条搜索结果（与具体搜索引擎解耦） */
export interface WebSearchItem {
  title: string;
  url: string;
  snippet: string;
  /** 来源描述：Tavily 返回 "tavily"，SearXNG 返回 engine 名（google/bing/duckduckgo…） */
  engine: string;
}

/** 单次搜索超时（毫秒） */
const SEARCH_TIMEOUT_MS = 10_000;

/* =========================================================
 * 实现 ①：Tavily（https://docs.tavily.com/documentation/api-reference/endpoint/search）
 * 只读 fields：query / max_results / search_depth / include_answer
 * ========================================================= */
async function searchTavily(
  query: string,
  maxResults: number,
): Promise<WebSearchItem[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY 未配置");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: Math.min(maxResults, 8),
      search_depth: "basic",
      include_answer: false,
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Tavily HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    results?: { title?: string; url?: string; content?: string }[];
  };
  return (json.results ?? []).map((r) => ({
    title: r.title ?? "未命名结果",
    url: r.url ?? "",
    snippet: r.content ?? "",
    engine: "tavily",
  }));
}

/* =========================================================
 * 实现 ②：SearXNG（自建实例，GET /search?q=..&format=json）
 * 参考：https://docs.searxng.org/dev/search_api.html
 * ========================================================= */
async function searchSearxng(
  query: string,
  maxResults: number,
): Promise<WebSearchItem[]> {
  const base = process.env.SEARXNG_BASE_URL;
  if (!base) throw new Error("SEARXNG_BASE_URL 未配置");
  const clean = base.replace(/\/+$/, "");
  const url = `${clean}/search?q=${encodeURIComponent(query)}&format=json`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`SearXNG HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    results?: { title?: string; url?: string; content?: string; engine?: string }[];
  };
  return (json.results ?? [])
    .slice(0, maxResults)
    .map((r) => ({
      title: r.title ?? "未命名结果",
      url: r.url ?? "",
      snippet: r.content ?? "",
      engine: String(r.engine ?? "searxng"),
    }));
}

/**
 * 对外统一入口：Tavily 优先 → SearXNG 降级 → 都失败返回 []
 * @param query      用户提问
 * @param maxResults 最多返回条数（默认 6，Tavily 内部再压到 8）
 */
export async function webSearch(
  query: string,
  maxResults = 6,
): Promise<WebSearchItem[]> {
  const errors: string[] = [];

  if (process.env.TAVILY_API_KEY) {
    try {
      return await searchTavily(query, maxResults);
    } catch (e) {
      errors.push(`Tavily: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (process.env.SEARXNG_BASE_URL) {
    try {
      return await searchSearxng(query, maxResults);
    } catch (e) {
      errors.push(`SearXNG: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.warn("[C] webSearch 未配置任何引擎，返回空:", errors.join(" | "));
  return [];
}
