"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { motion } from "framer-motion";
import type { KnowledgeGraph } from "@/clients/knowledge";
import { Minus, Plus, Scan } from "lucide-react";
import {
  kindLabel,
  nodeById,
  nodeColor,
  nodeLabelLines,
  nodeRadiusOf,
} from "../lib/graph-utils";
import type { NodePositions } from "../lib/layouts";
import {
  createFittedViewport,
  fitGraphViewBox,
  panViewportState,
  zoomViewportState,
} from "../lib/graph-viewport";
import { cn } from "@/lib/utils";

/** 边按关系类型着色；CITES 使用中性灰，其余按类型 */
const EDGE_COLORS: Record<string, string> = {
  CITES: "#94a3b8",
  AUTHORED_BY: "#34d399",
  PROPOSES: "#a78bfa",
  USES_AS_BASELINE: "#fbbf24",
  HAS_TOPIC: "#38bdf8",
  PUBLISHED_IN: "#2dd4bf",
  FUNDED_BY: "#fcd34d",
  AFFILIATED_WITH: "#fb7185",
};

function edgeColor(relation: string): string {
  return EDGE_COLORS[relation] ?? "#94a3b8";
}

interface GraphCanvasProps {
  graph: KnowledgeGraph;
  positions: NodePositions;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onCanvasClick: () => void;
}

/**
 * 知识底座图谱画布 —— 边 → 节点 → 图例。
 * 未知节点类型有默认展示（灰色 + kind 原文），不抛错。
 */
export function GraphCanvas({
  graph,
  positions,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onCanvasClick,
}: GraphCanvasProps) {
  const byId = nodeById(graph);
  const focusId = hoveredId ?? selectedId;
  const fitViewBox = useMemo(() => fitGraphViewBox(positions), [positions]);
  const [viewportState, setViewportState] = useState(() => createFittedViewport(fitViewBox));
  const [isPanning, setIsPanning] = useState(false);
  const drag = useRef<{ lastX: number; lastY: number } | null>(null);
  const didPan = useRef(false);

  const resetView = useCallback(() => {
    setViewportState(createFittedViewport(fitViewBox));
    didPan.current = false;
  }, [fitViewBox]);

  const zoomAt = useCallback(
    (factor: number, anchor: { x: number; y: number }) => {
      setViewportState((state) => zoomViewportState(state, factor, anchor, fitViewBox));
    },
    [fitViewBox],
  );

  const handleWheel = useCallback(
    (event: ReactWheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      zoomAt(
        event.deltaY < 0 ? 1.1 : 0.9,
        {
          x: (event.clientX - rect.left) / rect.width,
          y: (event.clientY - rect.top) / rect.height,
        },
      );
    },
    [zoomAt],
  );

  const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const target = event.target;
    if (event.button !== 0 || (target instanceof Element && target.closest("[data-graph-node]"))) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { lastX: event.clientX, lastY: event.clientY };
    didPan.current = false;
    setIsPanning(true);
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const deltaX = event.clientX - drag.current.lastX;
    const deltaY = event.clientY - drag.current.lastY;
    drag.current = { lastX: event.clientX, lastY: event.clientY };
    if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) didPan.current = true;
    const rect = event.currentTarget.getBoundingClientRect();
    setViewportState((state) => panViewportState(state, deltaX, deltaY, rect.width, rect.height));
  }, []);

  const handlePointerEnd = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
    setIsPanning(false);
  }, []);

  const handleCanvasClick = useCallback(() => {
    if (didPan.current) {
      didPan.current = false;
      return;
    }
    onCanvasClick();
  }, [onCanvasClick]);

  // 与当前焦点节点直接相连的节点（弱化其余）
  const neighbors = new Set<string>();
  if (focusId) {
    for (const edge of graph.edges) {
      if (edge.sourceId === focusId) neighbors.add(edge.targetId);
      if (edge.targetId === focusId) neighbors.add(edge.sourceId);
    }
    neighbors.add(focusId);
  }

  const root = byId.get(graph.rootId);
  const { x, y, width, height } = viewportState.viewBox;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-line/70 bg-card/30">
        <svg
          viewBox={`${x} ${y} ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className={cn(
            "h-full w-full select-none touch-none",
            isPanning ? "cursor-grabbing" : "cursor-grab",
          )}
          role="img"
          aria-label="论文关系图谱"
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {/* 边 */}
          {graph.edges.map((edge) => {
            const a = positions.get(edge.sourceId);
            const b = positions.get(edge.targetId);
            if (!a || !b) return null;
            const active =
              focusId !== null && (edge.sourceId === focusId || edge.targetId === focusId);
            const dimmed = focusId !== null && !active;
            return (
              <line
                key={`${edge.sourceId}→${edge.targetId}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={active ? "var(--color-primary)" : edgeColor(edge.relation)}
                strokeWidth={active ? 2.4 : edge.relation === "CITES" ? 1 : 1.4}
                strokeDasharray={edge.relation === "CITES" ? undefined : "4 3"}
                opacity={dimmed ? 0.18 : active ? 0.95 : 0.5}
              />
            );
          })}

          {/* 节点 */}
          {graph.nodes.map((node, index) => {
            const position = positions.get(node.id);
            if (!position) return null;
            const selected = node.id === selectedId;
            const dimmed = focusId !== null && !neighbors.has(node.id);
            const radius = nodeRadiusOf(node, graph, node.id === graph.rootId);
            const color = nodeColor(node.kind);
            const [line1, line2] = nodeLabelLines(node);
            return (
              <motion.g
                key={node.id}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: dimmed ? 0.22 : 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.02, 0.4), duration: 0.3 }}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  cursor: "pointer",
                }}
                data-graph-node="true"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(node.id);
                }}
                onMouseEnter={() => onHover(node.id)}
                onMouseLeave={() => onHover(null)}
              >
                <title>{node.label}</title>
                {/* 选中外圈 */}
                {selected && (
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={radius + 7}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                  />
                )}
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={radius}
                  fill={color}
                  fillOpacity={node.id === graph.rootId ? 1 : 0.8}
                  stroke="var(--color-card)"
                  strokeWidth={2}
                />
                {node.id === graph.rootId && (
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={radius - 4}
                    fill="none"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth={1.5}
                  />
                )}
                <text
                  x={position.x}
                  y={position.y + radius + 16}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={600}
                  className="fill-ink-2"
                >
                  {line1}
                </text>
                <text
                  x={position.x}
                  y={position.y + radius + 31}
                  textAnchor="middle"
                  fontSize={11}
                  className="fill-faint"
                >
                  {line2}
                </text>
              </motion.g>
            );
          })}
        </svg>
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border border-line/70 bg-card/90 p-1 shadow-card backdrop-blur">
          <button
            type="button"
            aria-label="缩小图谱"
            title="缩小图谱"
            onClick={() => zoomAt(0.85, { x: 0.5, y: 0.5 })}
            className="flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-panel hover:text-ink"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="min-w-10 text-center text-[10px] tabular-nums text-faint" aria-live="polite">
            {Math.round(viewportState.zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="放大图谱"
            title="放大图谱"
            onClick={() => zoomAt(1.18, { x: 0.5, y: 0.5 })}
            className="flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-panel hover:text-ink"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="适应视图"
            title="适应视图"
            onClick={resetView}
            className="ml-1 flex h-7 items-center gap-1 rounded-md px-2 text-[10px] text-muted transition-colors hover:bg-panel hover:text-ink"
          >
            <Scan className="size-3.5" />
            适应视图
          </button>
        </div>
      </div>

      {/* 图例 */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 text-[11px] text-faint">
        {root && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: nodeColor(root.kind) }} />
            中心论文
          </span>
        )}
        {Array.from(new Set(graph.nodes.map((node) => node.kind))).slice(0, 8).map((kind) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: nodeColor(kind) }} />
            {kindLabel(kind)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[#94a3b8]" />
          实线 = 引用关系
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-[#94a3b8]" />
          虚线 = 其他关系
        </span>
      </div>
    </div>
  );
}
