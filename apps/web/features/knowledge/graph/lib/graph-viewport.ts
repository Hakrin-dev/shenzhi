import { VIEW_H, VIEW_W } from "./graph-utils";
import type { NodePositions } from "./layouts";

export interface GraphViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphViewportState {
  viewBox: GraphViewBox;
  zoom: number;
}

export interface ViewportAnchor {
  /** Normalized x coordinate inside the SVG viewport. */
  x: number;
  /** Normalized y coordinate inside the SVG viewport. */
  y: number;
}

export const MIN_GRAPH_ZOOM = 0.65;
export const MAX_GRAPH_ZOOM = 3.5;

const VIEW_ASPECT_RATIO = VIEW_W / VIEW_H;
const LABEL_PADDING_X = 96;
const LABEL_PADDING_TOP = 64;
const LABEL_PADDING_BOTTOM = 96;
const MIN_FIT_WIDTH = VIEW_W * 0.72;
const MIN_FIT_HEIGHT = VIEW_H * 0.72;

/** Fit every layout coordinate, including room for the node labels, into a viewBox. */
export function fitGraphViewBox(positions: NodePositions): GraphViewBox {
  if (positions.size === 0) {
    return { x: 0, y: 0, width: VIEW_W, height: VIEW_H };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { x, y } of positions.values()) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const boundsMinX = minX - LABEL_PADDING_X;
  const boundsMaxX = maxX + LABEL_PADDING_X;
  const boundsMinY = minY - LABEL_PADDING_TOP;
  const boundsMaxY = maxY + LABEL_PADDING_BOTTOM;
  let width = Math.max(boundsMaxX - boundsMinX, MIN_FIT_WIDTH);
  let height = Math.max(boundsMaxY - boundsMinY, MIN_FIT_HEIGHT);

  if (width / height > VIEW_ASPECT_RATIO) {
    height = width / VIEW_ASPECT_RATIO;
  } else {
    width = height * VIEW_ASPECT_RATIO;
  }

  const centerX = (boundsMinX + boundsMaxX) / 2;
  const centerY = (boundsMinY + boundsMaxY) / 2;
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

export function createFittedViewport(viewBox: GraphViewBox): GraphViewportState {
  return { viewBox, zoom: 1 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Zoom around a normalized pointer anchor while keeping the anchor's graph point fixed. */
export function zoomViewportState(
  state: GraphViewportState,
  factor: number,
  anchor: ViewportAnchor,
  fitViewBox: GraphViewBox,
): GraphViewportState {
  const nextZoom = clamp(state.zoom * factor, MIN_GRAPH_ZOOM, MAX_GRAPH_ZOOM);
  if (nextZoom === state.zoom) return state;

  const anchorX = clamp(anchor.x, 0, 1);
  const anchorY = clamp(anchor.y, 0, 1);
  const anchorWorldX = state.viewBox.x + state.viewBox.width * anchorX;
  const anchorWorldY = state.viewBox.y + state.viewBox.height * anchorY;
  const width = fitViewBox.width / nextZoom;
  const height = fitViewBox.height / nextZoom;

  return {
    zoom: nextZoom,
    viewBox: {
      x: anchorWorldX - width * anchorX,
      y: anchorWorldY - height * anchorY,
      width,
      height,
    },
  };
}

/** Pan by screen-pixel deltas; positive pointer movement moves the graph with the pointer. */
export function panViewportState(
  state: GraphViewportState,
  deltaX: number,
  deltaY: number,
  viewportWidth: number,
  viewportHeight: number,
): GraphViewportState {
  if (viewportWidth <= 0 || viewportHeight <= 0) return state;

  return {
    ...state,
    viewBox: {
      ...state.viewBox,
      x: state.viewBox.x - (deltaX * state.viewBox.width) / viewportWidth,
      y: state.viewBox.y - (deltaY * state.viewBox.height) / viewportHeight,
    },
  };
}
