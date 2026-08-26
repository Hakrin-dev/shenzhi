"use client";

/**
 * 参考来源卡片组（C3 去 Mock：props 化 + 引用 [n] 双向联动）
 *
 * 【升级 · 第二阶段 N.5 收尾 Task 2】
 *  - 接入 lib/citations.tsx 的 CitationContext：
 *    · 卡片匹配 activeCitation → 边框 + 背景高亮（正向：点正文 [n] → 卡片亮）
 *    · 卡片 onClick → jumpFromCard(id) 反向把正文 [n] 标签高亮 + 滚入视野
 *    · 每张卡片外层加 data-citation-id={id}（用于正文 [n] 点进来时 querySelector 定位）
 *  - props.sources：真实来源（agent-chat 传 msg.sources，联网搜索 / 引用知识库 / 附件摘要）
 *  - props.limit：默认显示条数（默认 8，>limit 时出现「查看全部」展开）
 *  - sources 为空 → 返回 null（真实链路空状态不渲染）；deep-search 展示页不传 sources 时
 *    回退到 agentReferences（纯展示场景，无真实数据可渲染）
 */

import { useRef, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { agentReferences } from "@/lib/data/agent";
import { cn } from "@/lib/utils";
import { useCitation } from "@b/lib/citations";
import type { ChatSource } from "@b/types";

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
  /** 仅 deep-search 演示页使用 mock；对话页传 false */
  fallbackToMock = false,
}: {
  sources?: ChatSource[];
  limit?: number;
  fallbackToMock?: boolean;
}) {
  if (!sources || sources.length === 0) {
    if (!fallbackToMock) return null;
  }
  const data =
    sources && sources.length > 0
      ? sources
      : fallbackToMock
        ? FALLBACK_SOURCES
        : [];
  const [showAll, setShowAll] = useState(false);

  const {
    activeCitation,
    jumpFromCard,
    registerCardsRoot,
  } = useCitation();

  const rootRef = useRef<HTMLElement | null>(null);
  // 注册引用卡片容器到 CitationContext（正文 [n] 点进来时 scrollIntoView 用）
  const mergedRef = (el: HTMLElement | null) => {
    (rootRef as any).current = el;
    registerCardsRoot(el);
  };

  if (data.length === 0) return null;

  const shown = showAll || limit <= 0 ? data : data.slice(0, limit);
  const hasMore = data.length > limit;

  return (
    <section
      ref={mergedRef as any}
      className="rounded-2xl bg-card p-6 shadow-card"
    >
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
        {shown.map((ref) => {
          const isActive = activeCitation === Number(ref.id);
          return (
            <article
              key={ref.id}
              data-citation-id={ref.id}
              onClick={(e) => {
                e.stopPropagation();
                jumpFromCard(Number(ref.id));
              }}
              className={cn(
                "group cursor-pointer rounded-xl border p-3.5 transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5",
                // 默认边框
                "border-line",
                // ⭐ 推荐高亮
                ref.recommended &&
                  "border-[#FDE68A] bg-[#FFFBEB] dark:border-[#5a4a1a] dark:bg-[#26200f]",
                // ✨ 正文中 [n] 被点击（正向联动）：此卡片变成 primary 色 + ring
                isActive && [
                  "border-primary shadow-[0_0_0_3px_rgba(79,70,229,0.25)]",
                  "bg-primary/5 ring-1 ring-primary/40 -translate-y-0.5",
                ],
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white transition-all",
                    TONE_COLORS[ref.tone ?? "violet"],
                    isActive && "ring-2 ring-primary/40 scale-110",
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
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <p className={cn(
                "mt-2 line-clamp-3 text-[13px] font-medium leading-snug transition-colors",
                isActive ? "text-ink" : "text-ink-2 group-hover:text-ink",
              )}>
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
          );
        })}
      </div>
    </section>
  );
}
