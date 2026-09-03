import assert from "node:assert/strict";
import test from "node:test";

import type { KnowledgeGraph } from "../../clients/knowledge/types.js";
import {
  computeLayout,
  type GraphLayoutMode,
} from "../../features/knowledge/graph/lib/layouts.js";
import {
  createFittedViewport,
  fitGraphViewBox,
  MAX_GRAPH_ZOOM,
  MIN_GRAPH_ZOOM,
  panViewportState,
  zoomViewportState,
} from "../../features/knowledge/graph/lib/graph-viewport.js";

const GRAPH: KnowledgeGraph = {
  rootId: "root",
  nodes: [
    { id: "root", kind: "Paper", label: "Root", properties: {}, provenance: null },
    { id: "reference", kind: "Paper", label: "Reference", properties: {}, provenance: null },
    { id: "citation", kind: "Paper", label: "Citation", properties: {}, provenance: null },
    { id: "second", kind: "Paper", label: "Second", properties: {}, provenance: null },
  ],
  edges: [
    { sourceId: "root", targetId: "reference", relation: "CITES", description: null, weight: null, provenance: null },
    { sourceId: "citation", targetId: "root", relation: "CITES", description: null, weight: null, provenance: null },
    { sourceId: "reference", targetId: "second", relation: "CITES", description: null, weight: null, provenance: null },
  ],
};

test("fit viewBox contains every node for every layout mode", () => {
  const modes: GraphLayoutMode[] = ["radial", "treeHorizontal", "treeVertical", "force"];

  for (const mode of modes) {
    const positions = computeLayout(mode, GRAPH);
    const viewBox = fitGraphViewBox(positions);

    for (const position of positions.values()) {
      assert.ok(position.x >= viewBox.x);
      assert.ok(position.x <= viewBox.x + viewBox.width);
      assert.ok(position.y >= viewBox.y);
      assert.ok(position.y <= viewBox.y + viewBox.height);
    }
  }
});

test("zoom keeps the graph point under the pointer fixed and clamps its range", () => {
  const fitViewBox = { x: 0, y: 0, width: 1000, height: 700 };
  const state = createFittedViewport(fitViewBox);
  const anchor = { x: 0.25, y: 0.4 };
  const before = {
    x: state.viewBox.x + state.viewBox.width * anchor.x,
    y: state.viewBox.y + state.viewBox.height * anchor.y,
  };

  const zoomed = zoomViewportState(state, 2, anchor, fitViewBox);
  const after = {
    x: zoomed.viewBox.x + zoomed.viewBox.width * anchor.x,
    y: zoomed.viewBox.y + zoomed.viewBox.height * anchor.y,
  };

  assert.equal(zoomed.zoom, 2);
  assert.ok(Math.abs(after.x - before.x) < 0.0001);
  assert.ok(Math.abs(after.y - before.y) < 0.0001);
  assert.equal(zoomViewportState(state, 100, anchor, fitViewBox).zoom, MAX_GRAPH_ZOOM);
  assert.equal(zoomViewportState(state, 0.001, anchor, fitViewBox).zoom, MIN_GRAPH_ZOOM);
});

test("pan moves the viewBox in the direction of the pointer drag", () => {
  const fitViewBox = { x: 0, y: 0, width: 1000, height: 700 };
  const panned = panViewportState(
    createFittedViewport(fitViewBox),
    100,
    -70,
    1000,
    700,
  );

  assert.equal(panned.viewBox.x, -100);
  assert.equal(panned.viewBox.y, 70);
});
