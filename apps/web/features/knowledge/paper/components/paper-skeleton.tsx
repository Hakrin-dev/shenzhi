"use client";

/** 论文详情页加载骨架屏 */
export function KnowledgePaperSkeleton() {
  return (
    <div className="mt-6 rounded-2xl bg-card p-7 shadow-card" aria-busy="true" aria-label="正在加载论文详情">
      <div className="h-7 w-3/4 animate-pulse rounded bg-chip" />
      <div className="mt-4 h-3 w-1/2 animate-pulse rounded bg-chip" />
      <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-chip" />
      <div className="mt-6 grid max-w-md grid-cols-2 gap-3">
        <div className="h-20 animate-pulse rounded-xl bg-panel" />
        <div className="h-20 animate-pulse rounded-xl bg-panel" />
      </div>
      <div className="mt-6 h-9 w-32 animate-pulse rounded-lg bg-chip" />
      <div className="mt-7 h-4 w-16 animate-pulse rounded bg-chip" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-chip" />
        <div className="h-3 w-full animate-pulse rounded bg-chip" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-chip" />
      </div>
    </div>
  );
}
