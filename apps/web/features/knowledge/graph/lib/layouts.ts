/**
 * 知识底座图谱布局算法：radial（环形）/ tree（树形）/ force（力导向）。
 *
 * 输出 Map<nodeId, {x, y}> 的绝对坐标，配合 graph-canvas 的 SVG viewBox 使用。
 * 全部基于图结构确定性计算（力导向用固定随机种子），保证 SSR 一致。
 */
import type { KnowledgeGraph } from "@/clients/knowledge";
import { CENTER_X, CENTER_Y, VIEW_H, VIEW_W, degreeOf } from "./graph-utils";

export type GraphLayoutMode = "radial" | "treeHorizontal" | "treeVertical" | "force";

export interface PlacedNode {
  x: number;
  y: number;
}

export type NodePositions = Map<string, PlacedNode>;

/** 确定性伪随机（0~1），保证布局稳定 */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h / 0xffffffff;
}

/** BFS 计算每个节点相对 root 的层级深度 */
function computeDepths(graph: KnowledgeGraph): Map<string, number> {
  const depths = new Map<string, number>([[graph.rootId, 0]]);
  const queue = [graph.rootId];
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const edge of graph.edges) {
    adjacency.get(edge.sourceId)?.push(edge.targetId);
    adjacency.get(edge.targetId)?.push(edge.sourceId);
  }
  while (queue.length) {
    const current = queue.shift()!;
    const depth = depths.get(current) ?? 0;
    for (const next of adjacency.get(current) ?? []) {
      if (!depths.has(next)) {
        depths.set(next, depth + 1);
        queue.push(next);
      }
    }
  }
  return depths;
}

/** 环形布局：root 居中，其余按 BFS 层级同心环 */
export function radialLayout(graph: KnowledgeGraph): NodePositions {
  const positions: NodePositions = new Map();
  positions.set(graph.rootId, { x: CENTER_X, y: CENTER_Y });

  const depths = computeDepths(graph);
  const byDepth = new Map<number, string[]>();
  for (const node of graph.nodes) {
    const depth = depths.get(node.id) ?? 1;
    const list = byDepth.get(depth) ?? [];
    list.push(node.id);
    byDepth.set(depth, list);
  }

  const maxDepth = Math.max(0, ...byDepth.keys());
  for (const [depth, ids] of byDepth) {
    if (depth === 0) continue;
    const radius =
      maxDepth <= 1
        ? 250
        : 190 + ((depth - 1) / Math.max(maxDepth - 1, 1)) * 230;
    const startAngle = -Math.PI / 2 + (depth % 2) * 0.45;
    ids.forEach((id, index) => {
      const jitter = (hash(`${id}:angle`) - 0.5) * 0.35;
      const angle = (index / ids.length) * Math.PI * 2 + startAngle + jitter;
      const rJitter = (hash(`${id}:r`) - 0.5) * 30;
      positions.set(id, {
        x: Math.round(CENTER_X + (radius + rJitter) * Math.cos(angle)),
        y: Math.round(CENTER_Y + (radius + rJitter) * Math.sin(angle)),
      });
    });
  }
  return positions;
}

/** 树形布局：BFS 层级作为列/行，层内垂直/水平分布 */
export function treeLayout(
  graph: KnowledgeGraph,
  mode: "treeHorizontal" | "treeVertical",
): NodePositions {
  const positions: NodePositions = new Map();
  const depths = computeDepths(graph);
  const byDepth = new Map<number, string[]>();
  for (const node of graph.nodes) {
    const depth = depths.get(node.id) ?? 1;
    const list = byDepth.get(depth) ?? [];
    list.push(node.id);
    byDepth.set(depth, list);
  }
  const maxDepth = Math.max(0, ...byDepth.keys());

  const horizontal = mode === "treeHorizontal";
  const gapX = horizontal ? 210 : 170;
  const gapY = horizontal ? 96 : 110;

  for (const [depth, ids] of byDepth) {
    const size = ids.length;
    ids.forEach((id, index) => {
      const primary = horizontal ? CENTER_X + (depth - (maxDepth / 2)) * gapX : CENTER_Y + (depth - (maxDepth / 2)) * gapY;
      const offset = (index - (size - 1) / 2) * (horizontal ? gapY : gapX);
      const jitter = (hash(`${id}:tree`) - 0.5) * 18;
      positions.set(id, {
        x: Math.round(horizontal ? primary : CENTER_X + offset + jitter),
        y: Math.round(horizontal ? CENTER_Y + offset + jitter : primary),
      });
    });
  }
  return positions;
}

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** 力导向布局：简单斥力 + 弹簧（固定迭代与种子，输出稳定） */
export function forceLayout(graph: KnowledgeGraph): NodePositions {
  const positions: NodePositions = new Map();
  const bodies = new Map<string, Body>();
  const initial = radialLayout(graph);
  for (const node of graph.nodes) {
    const p = initial.get(node.id) ?? { x: CENTER_X, y: CENTER_Y };
    bodies.set(node.id, {
      x: p.x,
      y: p.y,
      vx: (hash(`${node.id}:vx`) - 0.5) * 8,
      vy: (hash(`${node.id}:vy`) - 0.5) * 8,
    });
  }
  const rootBody = bodies.get(graph.rootId);
  if (rootBody) {
    rootBody.x = CENTER_X;
    rootBody.y = CENTER_Y;
  }

  const ids = graph.nodes.map((node) => node.id);
  const degree = (id: string) => degreeOf(id, graph.edges);

  for (let iteration = 0; iteration < 260; iteration++) {
    // 斥力（任意两节点）
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = bodies.get(ids[i])!;
        const b = bodies.get(ids[j])!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.hypot(dx, dy), 1);
        const force = 4200 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }
    // 弹簧（沿边）
    for (const edge of graph.edges) {
      const a = bodies.get(edge.sourceId);
      const b = bodies.get(edge.targetId);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const target = 150;
      const force = (dist - target) * 0.02;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    // 向心力（把节点拉回中心附近）
    for (const id of ids) {
      const body = bodies.get(id)!;
      body.vx += (CENTER_X - body.x) * 0.002 * (1 + degree(id) * 0.02);
      body.vy += (CENTER_Y - body.y) * 0.002 * (1 + degree(id) * 0.02);
    }
    // 积分
    for (const id of ids) {
      const body = bodies.get(id)!;
      body.vx *= 0.78;
      body.vy *= 0.78;
      body.x += body.vx;
      body.y += body.vy;
    }
  }

  for (const id of ids) {
    const body = bodies.get(id)!;
    positions.set(id, {
      x: Math.round(Math.min(Math.max(body.x, 60), VIEW_W - 60)),
      y: Math.round(Math.min(Math.max(body.y, 60), VIEW_H - 60)),
    });
  }
  return positions;
}

export function computeLayout(mode: GraphLayoutMode, graph: KnowledgeGraph): NodePositions {
  if (mode === "force") return forceLayout(graph);
  if (mode === "treeHorizontal" || mode === "treeVertical") return treeLayout(graph, mode);
  return radialLayout(graph);
}

export const LAYOUT_LABELS: Record<GraphLayoutMode, string> = {
  radial: "环形布局",
  treeHorizontal: "横向树",
  treeVertical: "纵向树",
  force: "力导向",
};
