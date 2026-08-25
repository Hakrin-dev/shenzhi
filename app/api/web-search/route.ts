/**
 * C 模块 · 联网搜索 Server Route（POST /api/web-search）
 *
 * 接入点：
 *   - 前端 c-web-search-provider.tsx 注册的 webSearchFn 会 POST 本路由
 *   - 无 TAVILY_API_KEY / SEARXNG_BASE_URL 时返回空 sources（不报错，联网开关点了不中断对话）
 *
 * 请求体（JSON）：
 *   { query: string, max_results?: number }   // max_results 默认 6
 *
 * 响应（A 模块 ApiEnvelope 格式）：
 *   { code: 0,
 *     data: { sources: ChatSource[] } }
 *   失败 { code: 21001, message: "中文说明" }
 */

import { NextResponse } from "next/server";
import type { ApiEnvelope } from "@/types/ai-search";
import { webSearch, type WebSearchItem } from "@/lib/c-server/web-search-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESULTS_CAP = 10;

interface WebSearchRequest {
  query?: unknown;
  max_results?: unknown;
}

interface WebSearchData {
  sources: ReturnType<typeof toChatSources>;
}

/** WebSearchItem → 前端 ChatSource（供 SourcesSection / ReferenceGrid 渲染） */
export function toChatSources(items: WebSearchItem[]): {
  id: number;
  title: string;
  url?: string;
  venue?: string;
  snippet?: string;
  type?: "web";
}[] {
  return items.map((it, idx) => ({
    id: idx + 1,
    title: it.title,
    url: it.url || undefined,
    // 来源行：有发布日期显示「发布于 YYYY-MM-DD」，否则显示引擎名
    venue: it.publishedDate
      ? `发布于 ${it.publishedDate.slice(0, 10)}`
      : it.engine,
    snippet: it.snippet ? it.snippet.slice(0, 500) : undefined,
    type: "web",
  }));
}

export async function POST(
  req: Request,
): Promise<NextResponse<ApiEnvelope<WebSearchData>>> {
  let body: WebSearchRequest;
  try {
    body = (await req.json()) as WebSearchRequest;
  } catch (e) {
    return NextResponse.json<ApiEnvelope<never>>(
      {
        code: 21001,
        message: `请求体不是合法 JSON：${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 400 },
    );
  }

  if (typeof body.query !== "string" || body.query.trim().length === 0) {
    return NextResponse.json<ApiEnvelope<never>>(
      { code: 21001, message: "query 缺失或为空字符串" },
      { status: 400 },
    );
  }

  const maxResults =
    typeof body.max_results === "number" && body.max_results > 0
      ? Math.min(Math.floor(body.max_results), MAX_RESULTS_CAP)
      : 6;

  try {
    const items = await webSearch(body.query.trim().slice(0, 500), maxResults);
    return NextResponse.json<ApiEnvelope<WebSearchData>>({
      code: 0,
      data: { sources: toChatSources(items) },
    });
  } catch (e) {
    return NextResponse.json<ApiEnvelope<never>>(
      {
        code: 21001,
        message: `联网搜索失败：${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 },
    );
  }
}
