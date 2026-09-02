import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type {
  KnowledgeGraph,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "../../clients/knowledge/types.js";
import * as graphUtils from "../../features/knowledge/graph/lib/graph-utils.js";

function makeNode(
  id: string,
  kind: KnowledgeGraphNode["kind"] = "Paper",
): KnowledgeGraphNode {
  return {
    id,
    kind,
    label: id,
    properties: {},
    provenance: { source: "test" },
  };
}

function makeEdge(
  sourceId: string,
  targetId: string,
  relation: KnowledgeGraphEdge["relation"],
): KnowledgeGraphEdge {
  return {
    sourceId,
    targetId,
    relation,
    description: null,
    weight: null,
    provenance: { source: "test" },
  };
}

function makeGraph(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
): KnowledgeGraph {
  return {
    rootId: "root",
    nodes,
    edges,
    provenance: { source: "test" },
  };
}

test("direction=all preserves full heterogeneous graph node and edge counts", () => {
  const fullGraph = makeGraph(
    [makeNode("root"), makeNode("author", "Author"), makeNode("topic", "Topic")],
    [
      makeEdge("root", "author", "AUTHORED_BY"),
      makeEdge("root", "topic", "HAS_TOPIC"),
    ],
  );

  const displayGraph = graphUtils.filterGraphByDirection(fullGraph, "all");

  assert.equal(displayGraph.nodes.length, fullGraph.nodes.length);
  assert.equal(displayGraph.edges.length, fullGraph.edges.length);
  assert.deepEqual(displayGraph, fullGraph);
});

test("related papers stays empty when a full graph has no CITES edges", () => {
  const fullGraph = makeGraph([makeNode("root"), makeNode("author", "Author")], [
    makeEdge("root", "author", "AUTHORED_BY"),
  ]);

  assert.deepEqual(graphUtils.relatedPapers(fullGraph), []);
});

test("classifies root-to-paper CITES as References", () => {
  const fullGraph =
    makeGraph([makeNode("root"), makeNode("reference")], [
      makeEdge("root", "reference", "CITES"),
    ]);

  assert.deepEqual(
    graphUtils.relatedPapers(fullGraph).map(({ id, relationDirection }) => ({ id, relationDirection })),
    [{ id: "reference", relationDirection: "reference" }],
  );
});

test("classifies paper-to-root CITES as Citations", () => {
  const fullGraph =
    makeGraph([makeNode("root"), makeNode("citation")], [
      makeEdge("citation", "root", "CITES"),
    ]);

  assert.deepEqual(
    graphUtils.relatedPapers(fullGraph).map(({ id, relationDirection }) => ({ id, relationDirection })),
    [{ id: "citation", relationDirection: "citation" }],
  );
});

test("unknown nodes and relations stay in the full graph", () => {
  const fullGraph = makeGraph(
    [makeNode("root"), makeNode("unknown", "FutureEntity")],
    [makeEdge("root", "unknown", "FUTURE_RELATION")],
  );

  const displayGraph = graphUtils.filterGraphByDirection(fullGraph, "all");

  assert.deepEqual(displayGraph.nodes.map((node) => node.kind), ["Paper", "FutureEntity"]);
  assert.equal(displayGraph.edges[0]?.relation, "FUTURE_RELATION");
});

test("workbench sends fullGraph through direction filtering without paper-only derivation", () => {
  const workbench = readFileSync(
    "features/knowledge/graph/components/graph-workbench.tsx",
    "utf8",
  );

  assert.doesNotMatch(workbench, /derivePaperRelationGraph/);
  assert.match(workbench, /filterGraphByDirection\(fullGraph, direction\)/);
  assert.match(workbench, /graph=\{displayGraph\}/);
});

test("GraphCanvas has an interactive fit and viewport contract", () => {
  const canvas = readFileSync(
    "features/knowledge/graph/components/graph-canvas.tsx",
    "utf8",
  );

  assert.match(canvas, /fitGraphViewBox/);
  assert.match(canvas, /onWheel/);
  assert.match(canvas, /onPointerMove/);
  assert.match(canvas, /适应视图/);
});
