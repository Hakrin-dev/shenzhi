"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LayoutGrid, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getKnowledgeClient,
  KnowledgeClientError,
} from "@/clients/knowledge";
import type {
  KnowledgeGraphNode,
  KnowledgePaperDetail,
} from "@/clients/knowledge";
import { GraphCanvas } from "./graph-canvas";
import { GraphNodeDetail } from "./graph-node-detail";
import { GraphRelatedPanel } from "./graph-related-panel";
import {
  filterGraphByDirection,
  relatedPapers,
  type GraphDirectionFilter,
} from "../lib/graph-utils";
import {
  computeLayout,
  LAYOUT_LABELS,
  type GraphLayoutMode,
} from "../lib/layouts";
import { cn } from "@/lib/utils";

const LAYOUT_OPTIONS: GraphLayoutMode[] = ["radial", "treeHorizontal", "treeVertical", "force"];
const DEPTH_OPTIONS = [1, 2, 3];

/** 图谱工作台 —— 三栏：左关联论文 / 中图谱 / 右详情 */
export function KnowledgeGraphWorkbench({ paperId }: { paperId: string }) {
  const router = useRouter();
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>("radial");
  const [direction, setDirection] = useState<GraphDirectionFilter>("all");
  const [depth, setDepth] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 图谱数据：以 URL paperId + depth 为 key；切换中心论文 / 深度自动重取
  const graphQuery = useQuery({
    queryKey: ["knowledge", "graph", paperId, depth],
    queryFn: () => getKnowledgeClient().graph(paperId, depth),
    staleTime: 60_000,
  });

  const graph = graphQuery.data ?? null;
  const graphError = graphQuery.isError ? toKnowledgeError(graphQuery.error) : null;

  // 选中节点：默认 root；切换到新中心论文时由页面 key 重挂载重置
  const selectedNode = useMemo(() => {
    if (!graph) return null;
    if (selectedId && graph.nodes.some((node) => node.id === selectedId)) {
      return graph.nodes.find((node) => node.id === selectedId) ?? null;
    }
    return graph.nodes.find((node) => node.id === graph.rootId) ?? null;
  }, [graph, selectedId]);

  const isPaperNode = selectedNode?.kind === "Paper";
  const selectedPaperId = isPaperNode ? selectedNode.id : null;

  // 论文详情：仅选中 Paper 节点时获取；React Query 自动缓存
  const detailQuery = useQuery({
    queryKey: ["knowledge", "paper", selectedPaperId],
    queryFn: () => getKnowledgeClient().paper(selectedPaperId as string),
    enabled: Boolean(selectedPaperId),
    staleTime: 60_000,
  });

  const displayGraph = useMemo(
    () => (graph ? filterGraphByDirection(graph, direction) : null),
    [graph, direction],
  );
  const positions = useMemo(
    () => (displayGraph ? computeLayout(layoutMode, displayGraph) : null),
    [displayGraph, layoutMode],
  );
  const related = useMemo(() => (graph ? relatedPapers(graph) : []), [graph]);
  const centerTitle = graph?.nodes.find((node) => node.id === graph.rootId)?.label ?? "";

  const pickCenter = (id: string) => {
    // 切换中心论文：更新 URL → 页面 key 重挂载重置图谱
    router.push(`/knowledge/search/${encodeURIComponent(id)}/graph`);
  };

  if (graphQuery.isLoading) {
    return <WorkbenchLoading />;
  }

  if (graphError || !graph || !displayGraph || !positions || !selectedNode) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center rounded-2xl bg-card px-10 py-12 text-center shadow-card">
          <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
            <WifiOff className="size-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-ink-2">
            {graphError?.code === "NOT_FOUND" ? "未找到这篇论文的关系图谱" : "图谱加载失败"}
          </p>
          <p className="mt-2 max-w-sm text-xs text-faint">
            {graphError?.message ?? "请检查论文标识或稍后重试"}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-5"
            onClick={() => void graphQuery.refetch()}
          >
            <RefreshCw className="size-3.5" />
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 顶栏 */}
      <header className="flex h-13 shrink-0 items-center gap-3 border-b border-line bg-card px-5 py-2.5">
        <Link
          href="/knowledge/search"
          className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          返回检索
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold text-ink">
          {centerTitle || "论文关系图谱"}
        </h1>

        {/* 布局切换 */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-chip p-0.5">
          {LAYOUT_OPTIONS.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setLayoutMode(mode)}
              title={LAYOUT_LABELS[mode]}
              className={cn(
                "flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] transition-colors",
                layoutMode === mode ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              <LayoutGrid className="size-3" />
              <span className="hidden lg:inline">{LAYOUT_LABELS[mode]}</span>
            </button>
          ))}
        </div>

        {/* 深度选择 */}
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-chip p-0.5">
          <span className="pl-2 text-[10px] text-faint">深度</span>
          {DEPTH_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDepth(value)}
              className={cn(
                "h-7 rounded-md px-2.5 text-[11px] transition-colors",
                depth === value ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </header>

      {/* 三栏主体 */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="order-2 w-full shrink-0 border-t border-line bg-card p-4 lg:order-1 lg:w-72 lg:border-r lg:border-t-0 lg:overflow-hidden">
          <GraphRelatedPanel
            centerTitle={centerTitle}
            related={related}
            direction={direction}
            onDirectionChange={setDirection}
            selectedId={selectedNode.id}
            onSelect={setSelectedId}
            onPickCenter={pickCenter}
          />
        </aside>

        <main className="order-1 min-w-0 flex-1 bg-panel/40 p-4 lg:order-2">
          <GraphCanvas
            graph={displayGraph}
            positions={positions}
            selectedId={selectedNode.id}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
            onHover={setHoveredId}
            onCanvasClick={() => setSelectedId(graph.rootId)}
          />
        </main>

        <aside className="order-3 w-full shrink-0 border-t border-line bg-card p-5 lg:w-80 lg:border-l lg:border-t-0 lg:overflow-hidden">
          <GraphNodeDetail
            node={selectedNode}
            paper={
              detailQuery.data ??
              (selectedNode.kind === "Paper" ? paperDetailFromNode(selectedNode) : null)
            }
            loading={detailQuery.isLoading}
            error={detailQuery.isError ? toKnowledgeError(detailQuery.error) : null}
            isCenter={selectedNode.id === graph.rootId}
            onRetry={() => void detailQuery.refetch()}
          />
        </aside>
      </div>
    </div>
  );
}

/** 知识底座错误归一化 */
function toKnowledgeError(error: unknown): KnowledgeClientError {
  return error instanceof KnowledgeClientError
    ? error
    : new KnowledgeClientError("UNKNOWN", error instanceof Error ? error.message : "加载失败");
}

/** 图谱节点属性 → 详情兜底数据（详情接口未返回时使用） */
function paperDetailFromNode(node: KnowledgeGraphNode): KnowledgePaperDetail {
  return {
    id: node.id,
    title: node.label,
    abstract: node.properties.abstract ?? null,
    authors: Array.isArray(node.properties.authors) ? (node.properties.authors as string[]) : [],
    year: node.properties.year ?? null,
    venue: node.properties.venue ?? null,
    doi: node.properties.doi ?? null,
    pdfUrl: node.properties.pdfUrl ?? null,
    keywords: Array.isArray(node.properties.keywords) ? (node.properties.keywords as string[]) : [],
    subjects: [],
    citationCount: null,
    referenceCount: null,
    provenance: node.provenance,
  };
}

function WorkbenchLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-10 py-12 text-center shadow-card">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="text-sm text-muted">正在加载关系图谱…</p>
      </div>
    </div>
  );
}
