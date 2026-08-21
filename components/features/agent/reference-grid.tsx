"use client";

/**
 * 参考来源卡片组（C3 去 Mock：props 化）
 *
 * - props.sources：真实来源（agent-chat 传 msg.sources，联网搜索 / 引用知识库 / 附件摘要）
 * - props.limit：默认显示条数（默认 8，>limit 时出现「查看全部」展开）
 * - sources 为空 → 返回 null（真实链路空状态不渲染）；deep-search 展示页不传 sources 时
 *   回退到 agentReferences（纯展示场景，无真实数据可渲染）
 */

import { useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { agentReferences } from "@/lib/data/agent";
import { cn } from "@/lib/utils";
import type { ChatSource } from "@/types";

/** deep-search 展示页兜底：把 mock AgentReference[] 归一化成 ChatSource[] */
const FALLBACK_SOURCES: ChatSource[] = agentReferences.map((r) => ({
  id: r.id,
  title: r.title,
  venue: r.venue,
  author: r.author,
  citations: r.citations,
  tone: r.tone,
  recommended: r.recommended,
}));

const TONE_COLORS: Record<string, string> = {
  violet: "bg-primary",
  green: "bg-success",
  amber: "bg-[#B45309] dark:bg-[#d99a2b]",
  gray: "bg-muted",
};

export function ReferenceGrid({
  sources,
  limit = 8,
}: {
  sources?: ChatSource[];
  limit?: number;
}) {
  const data = sources && sources.length > 0 ? sources : FALLBACK_SOURCES;
  const [showAll, setShowAll] = useState(false);
  if (data.length === 0) return null;

  const shown = showAll || limit <= 0 ? data : data.slice(0, limit);
  const hasMore = data.length > limit;

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ink">
          参考来源 · {data.length} 篇
        </h3>
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {showAll ? "收起" : "查看全部"}
            <ArrowRight
              className={cn("size-3 transition-transform", showAll && "rotate-90")}
            />
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shown.map((ref) => (
          <article
            key={ref.id}
            className={cn(
              "cursor-pointer rounded-xl border border-line p-3.5 transition-colors hover:border-primary/40",
              ref.recommended &&
                "border-[#FDE68A] bg-[#FFFBEB] dark:border-[#5a4a1a] dark:bg-[#26200f]",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white",
                  TONE_COLORS[ref.tone ?? "violet"],
                )}
              >
                {ref.id}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-faint">
                {ref.venue}
              </span>
              {ref.url && (
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-faint transition-colors hover:text-primary"
                  aria-label="打开来源链接"
                >
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <p className="mt-2 line-clamp-3 text-[13px] font-medium leading-snug text-ink-2">
              {ref.title}
            </p>
            {(ref.author || ref.citations) && (
              <p className="mt-2 text-[11px] text-faint">
                {ref.author}
                {ref.author && ref.citations && " · "}
                {ref.citations}
              </p>
            )}
            {ref.snippet && (
              <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted">
                {ref.snippet}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
