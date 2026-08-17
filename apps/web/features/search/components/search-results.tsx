"use client";

import { useQuery } from "@tanstack/react-query";
import { PaperCard } from "./paper-card";
import { ResearchersRail } from "./researchers-rail";
import { searchLocalPapers, searchLocalScholars } from "@/lib/data/search";
import type { FeedPaper, Scholar } from "@/types";

async function fetchSearch(query: string): Promise<{
  papers: FeedPaper[];
  scholars: Scholar[];
}> {
  await new Promise((r) => setTimeout(r, 180));
  return {
    papers: searchLocalPapers(query),
    scholars: searchLocalScholars(query),
  };
}

export function SearchResults({ query }: { query: string }) {
  const q = query.trim();
  const { data, isFetching } = useQuery({
    queryKey: ["search", "explore", q],
    queryFn: () => fetchSearch(q),
    enabled: q.length > 0,
    placeholderData: q
      ? { papers: searchLocalPapers(q), scholars: searchLocalScholars(q) }
      : undefined,
  });

  if (!q) {
    return (
      <p className="rounded-2xl bg-card px-6 py-10 text-center text-sm text-muted shadow-card">
        请输入关键词，选择「搜索」或按 Alt+Enter 查看平台已有内容。
      </p>
    );
  }

  const papers = data?.papers ?? [];
  const scholars = data?.scholars ?? [];

  if (!isFetching && papers.length === 0) {
    return (
      <div className="space-y-5">
        <p className="rounded-2xl bg-card px-6 py-10 text-center text-sm text-muted shadow-card">
          未找到与「{q}」相关的论文。可尝试更换关键词，或切换到「问 AI」。
        </p>
        <ResearchersRail scholars={scholars} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="px-1 text-sm text-muted">
        「{q}」的搜索结果 · {papers.length} 篇
      </p>
      <div className="space-y-5">
        {papers.map((paper, i) => (
          <PaperCard key={paper.id} paper={paper} index={i} layout="explore" />
        ))}
      </div>
      <ResearchersRail scholars={scholars} />
    </div>
  );
}
