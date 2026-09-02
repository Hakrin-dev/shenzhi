"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ExternalLink,
  FileText,
  Network,
  RefreshCw,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/common/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getKnowledgeClient,
  KnowledgeClientError,
} from "@/clients/knowledge";
import type { KnowledgePaperDetail } from "@/clients/knowledge";
import { KnowledgePaperSkeleton } from "./components/paper-skeleton";
import { knowledgeQueryRetry } from "../retry";

async function fetchPaper(paperId: string) {
  const client = getKnowledgeClient();
  return client.paper(paperId);
}

/** DOI → 链接 */
function doiHref(doi: string): string {
  return doi.startsWith("http") ? doi : `https://doi.org/${doi}`;
}

/** 论文详情页 `/knowledge/search/[paperId]` */
export function KnowledgePaperDetailPage({ paperId }: { paperId: string }) {
  const { data: paper, isPending, isError, error, refetch } = useQuery({
    queryKey: ["knowledge", "paper", paperId],
    queryFn: () => fetchPaper(paperId),
    retry: knowledgeQueryRetry,
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-[860px] px-6 py-8 lg:px-8">
        <Link
          href="/knowledge/search"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          返回论文检索
        </Link>

        {isPending && (
          <>
            <KnowledgePaperSkeleton />
          </>
        )}

        {isError && (
          <div className="mt-6 flex min-h-[300px] flex-col items-center justify-center rounded-2xl bg-card px-6 py-12 text-center shadow-card">
            <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
              <BookOpen className="size-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-ink-2">
              {(error instanceof KnowledgeClientError && error.code === "NOT_FOUND")
                ? "未找到这篇论文"
                : "论文详情加载失败"}
            </p>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-faint">
              {error instanceof Error ? error.message : "请稍后重试"}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-5"
              onClick={() => void refetch()}
            >
              <RefreshCw className="size-3.5" />
              重新加载
            </Button>
          </div>
        )}

        {paper && <PaperDetailBody paper={paper} />}
      </div>
    </AppShell>
  );
}

function PaperDetailBody({ paper }: { paper: KnowledgePaperDetail }) {
  const authors = paper.authors.length ? paper.authors.join(" · ") : "未知作者";

  return (
    <article className="mt-6 rounded-2xl bg-card p-7 shadow-card">
      {/* 标题 */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-snug tracking-tight text-ink">
            {paper.title}
          </h1>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
            <Users className="size-4 text-faint" />
            {authors}
          </p>
          <p className="mt-1.5 text-[13px] text-faint">
            {paper.venue ?? "暂无会议"} · {paper.year ?? "—"}
          </p>
        </div>
        <Link
          href={`/knowledge/search/${encodeURIComponent(paper.id)}/graph`}
          className="shrink-0"
        >
          <Button size="sm" className="rounded-lg">
            <Network className="size-4" />
            关系图谱
          </Button>
        </Link>
      </div>

      {/* 指标卡 */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
        <MetricCard label="被引用" value={paper.citationCount} />
        <MetricCard label="参考文献" value={paper.referenceCount} />
      </div>

      {/* 操作 */}
      {(paper.pdfUrl || paper.doi) && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {paper.pdfUrl && (
            <a href={paper.pdfUrl} target="_blank" rel="noreferrer">
              <Button size="sm">
                <FileText className="size-4" />
                查看 PDF
                <ExternalLink className="size-3.5" />
              </Button>
            </a>
          )}
          {paper.doi && (
            <a href={doiHref(paper.doi)} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">
                DOI / 论文主页
                <ArrowRight className="size-3.5" />
              </Button>
            </a>
          )}
        </div>
      )}

      {/* 摘要 */}
      {paper.abstract && (
        <section className="mt-7">
          <h2 className="text-sm font-semibold text-ink-2">摘要</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{paper.abstract}</p>
        </section>
      )}

      {/* 关键词 / 学科 */}
      {(paper.keywords.length > 0 || paper.subjects.length > 0) && (
        <section className="mt-7 border-t border-line pt-5">
          <h2 className="text-sm font-semibold text-ink-2">关键词与学科</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {paper.keywords.map((keyword) => (
              <Badge key={keyword} variant="violet">
                {keyword}
              </Badge>
            ))}
            {paper.subjects.map((subject) => (
              <Badge key={subject} variant="amber">
                {subject}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* 标识符 */}
      {paper.doi && (
        <p className="mt-7 border-t border-line pt-4 text-xs text-faint">
          DOI：<span className="break-all">{paper.doi}</span>
        </p>
      )}
    </article>
  );
}

function MetricCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-line/70 bg-panel px-4 py-3">
      <p className="text-lg font-bold tabular-nums text-ink">
        {value === null ? "—" : value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[11px] text-faint">
        {label}
        {value === null ? "（暂无数据）" : ""}
      </p>
    </div>
  );
}
