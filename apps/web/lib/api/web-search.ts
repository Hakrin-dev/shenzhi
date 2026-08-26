import type { ChatSource } from "@b/types";
import type { ChatReference } from "@/types/ai-search";

/** 调用 Next.js 路由 POST /api/b/web-search（服务端走 Tavily REST） */
export async function fetchWebSearchSources(
  query: string,
  signal?: AbortSignal,
): Promise<ChatSource[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const res = await fetch("/api/b/web-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query: q, max_results: 6 }),
      signal: signal ?? AbortSignal.timeout(12_000),
    });
    const json = (await res.json()) as {
      code?: number;
      message?: string;
      data?: { sources?: ChatSource[] };
    };
    if (!res.ok || json.code !== 0) {
      console.warn("[web-search]", json.message ?? res.status);
      return [];
    }
    return json.data?.sources ?? [];
  } catch (e) {
    if (signal?.aborted) return [];
    console.warn("[web-search] 请求异常:", e);
    return [];
  }
}

export function webSourcesToReferences(sources: ChatSource[]): ChatReference[] {
  return sources.map((s) => ({
    ordinal: s.id,
    source_type: "web",
    source_id: s.url ?? `src_${s.id}`,
    title: s.title,
    venue: s.venue ?? null,
    org: null,
    authors: s.author ?? "",
    citation_count: Number((s.citations ?? "").replace(/\D/g, "")) || 0,
    recommended: Boolean(s.recommended),
    url: s.url ?? null,
  }));
}
