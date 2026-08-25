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
 *
 * 【P2 优化】
 *  - 显示域名 + 站点图标（favicon 从 Google S2 取）
 *  - 来源类型标签（论文 / 网页 / 专利等）
 *  - 更紧凑的信息层级 + hover 微动效
 */

import { useRef, useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  Landmark,
  ScrollText,
} from "lucide-react";
import { agentReferences } from "@/lib/data/agent";
import { cn } from "@/lib/utils";
import { useCitation } from "@/lib/citations";
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

/** 来源类型 → 图标 + 标签 */
const TYPE_META: Record<string, { icon: any; label: string }> = {
  paper: { icon: FileText, label: "论文" },
  web: { icon: Globe, label: "网页" },
  patent: { icon: ScrollText, label: "专利" },
  funding: { icon: Landmark, label: "基金" },
  scholar: { icon: GraduationCap, label: "学者" },
  institution: { icon: Landmark, label: "机构" },
};

/** 从 URL 提取域名（去掉 www.） */
function getDomain(url?: string): string {
  if (!url) return "";
  try {
    const host = new URL(url).hostname;
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function ReferenceGrid({
  sources,
  limit = 8,
}: {
  sources?: ChatSource[];
  limit?: number;
}) {
  const data = sources && sources.length > 0 ? sources : FALLBACK_SOURCES;
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
      className="rounded-2xl border border-line/60 bg-card/80 p-4 backdrop-blur shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <span className="inline-block size-1.5 rounded-full bg-primary" />
          参考来源 · {data.length} 篇
        </h3>
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            {showAll ? "收起" : "查看全部"}
            <ArrowRight
              className={cn("size-3 transition-transform", showAll && "rotate-90")}
            />
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {shown.map((ref) => {
          const isActive = activeCitation === Number(ref.id);
          const domain = getDomain(ref.url);
          const typeMeta = ref.type ? TYPE_META[ref.type] : null;
          const TypeIcon = typeMeta?.icon ?? FileText;

          return (
            <article
              key={ref.id}
              data-citation-id={ref.id}
              onClick={(e) => {
                e.stopPropagation();
                jumpFromCard(Number(ref.id));
              }}
              className={cn(
                "group cursor-pointer rounded-xl border p-3 transition-all duration-200 hover:border-primary/40 hover:shadow-md",
                // 默认边框
                "border-line/70 bg-card/50",
                // ⭐ 推荐高亮
                ref.recommended &&
                  "border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20",
                // ✨ 正文中 [n] 被点击（正向联动）：此卡片变成 primary 色 + ring
                isActive && [
                  "border-primary shadow-[0_0_0_3px_rgba(79,70,229,0.2)]",
                  "bg-primary/5 ring-1 ring-primary/30 -translate-y-0.5",
                ],
              )}
            >
              <div className="flex items-start gap-2.5">
                {/* 序号徽章 */}
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white transition-all",
                    TONE_COLORS[ref.tone ?? "violet"],
                    isActive && "ring-2 ring-primary/40 scale-110",
                  )}
                >
                  {ref.id}
                </span>

                {/* 右侧主内容 */}
                <div className="min-w-0 flex-1">
                  {/* 标题 */}
                  <p
                    className={cn(
                      "line-clamp-2 text-[12.5px] font-medium leading-snug transition-colors",
                      isActive
                        ? "text-ink"
                        : "text-ink-2 group-hover:text-ink",
                    )}
                  >
                    {ref.title}
                  </p>

                  {/* 元信息行：类型 / 来源 / 域名 */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-faint">
                    {typeMeta && (
                      <span className="inline-flex items-center gap-1">
                        <TypeIcon className="size-3" />
                        {typeMeta.label}
                      </span>
                    )}
                    {ref.venue && (
                      <span className="truncate">{ref.venue}</span>
                    )}
                    {domain && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <Globe className="size-2.5" />
                        {domain}
                      </span>
                    )}
                    {ref.url && (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto shrink-0 text-faint transition-colors hover:text-primary"
                        aria-label="打开来源链接"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>

                  {/* 摘要 snippet（有则显示，最多 2 行） */}
                  {ref.snippet && (
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-muted">
                      {ref.snippet}
                    </p>
                  )}

                  {/* 作者 / 引用数 */}
                  {(ref.author || ref.citations) && (
                    <p className="mt-1.5 text-[10.5px] text-faint">
                      {ref.author}
                      {ref.author && ref.citations && " · "}
                      {ref.citations}
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
