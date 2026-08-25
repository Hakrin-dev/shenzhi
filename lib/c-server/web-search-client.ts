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
  /** 发布/更新日期（Tavily news topic 返回 "YYYY-MM-DD…"；general 通常无） */
  publishedDate?: string;
}

/** 单次搜索超时（毫秒） */
const SEARCH_TIMEOUT_MS = 10_000;

/**
 * 时效性查询启发式：含这些关键词时切到 topic=news
 * （news 结果自带 published_date，且严格按时间排序）
 */
const NEWS_QUERY_RE =
  /最新|今天|今日|本周|本月|近期|最近|新闻|快讯|热点|突破|发布|上线|召开|举行|现在|当前|latest|news|today|recent|now|20\d{2}/i;

/* =========================================================
 * 实现 ①：Tavily（https://docs.tavily.com/documentation/api-reference/endpoint/search）
 * 参数按 2025+ 版 API：time_range 取代已废弃的 days（days 仅 topic=news 且已不推荐）
 * ========================================================= */
async function searchTavily(
  query: string,
  maxResults: number,
): Promise<WebSearchItem[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY 未配置");
  const isNews = NEWS_QUERY_RE.test(query);
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: Math.min(maxResults, 8),
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      // 时效性查询走 news（结果带 published_date + 按时间排序）；概念型查询走 general
      topic: isNews ? "news" : "general",
      // time_range：从当前日期回溯，按发布/更新时间过滤（day/week/month/year，两种 topic 通用）
      time_range: isNews ? "week" : "month",
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Tavily API Key 无效（HTTP ${res.status}）。请到 https://app.tavily.com/home 的 API Keys 页复制有效 Key 更新 .env.local 的 TAVILY_API_KEY，并重启服务。原始响应：${body}`,
      );
    }
    throw new Error(`Tavily HTTP ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    results?: { title?: string; url?: string; content?: string; published_date?: string }[];
  };
  return (json.results ?? []).map((r) => ({
    title: r.title ?? "未命名结果",
    url: r.url ?? "",
    snippet: r.content ?? "",
    engine: "tavily",
    publishedDate: normalizeDate(r.published_date),
  }));
}

/** 把 Tavily 的多种日期格式（RFC2822 / ISO / 中文）归一化为 YYYY-MM-DD */
function normalizeDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  // 兜底：原样保留（如 "2026年8月22日"）
  return raw;
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
 * 对外统一入口：Tavily 优先 → SearXNG 降级 → 都失败 throw（route 转成中文错误返回前端）
 * 注意：失败必须上抛而不是静默返回 []，否则用户开着联网开关却拿不到任何来源，
 * 也看不到失败原因（Key 无效等问题会被完全掩盖）。
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
  } else {
    errors.push("Tavily: TAVILY_API_KEY 未配置");
  }
  if (process.env.SEARXNG_BASE_URL) {
    try {
      return await searchSearxng(query, maxResults);
    } catch (e) {
      errors.push(`SearXNG: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(errors.join(" | "));
}
