/** Decode the path-segment representation of an opaque Knowledge paper ID once. */
export function decodeKnowledgePaperRouteId(encodedPaperId: string): string {
  return decodeURIComponent(encodedPaperId);
}
