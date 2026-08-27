"use client";

import { useState } from "react";
import { ExternalLink, FileText, Globe } from "lucide-react";
import type { ChatReference } from "@/types/ai-search";
import { cn } from "@/lib/utils";
import { useCitation } from "./citations";

/** B's real-source grid; deliberately no mock fallback for an empty result. */
export function ReferenceGrid({ references }: { references: ChatReference[] }) {
  const [all, setAll] = useState(false);
  const { active, jump } = useCitation();
  if (!references.length) return null;
  return <section className="mt-4 rounded-2xl border border-line bg-card p-4">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium">参考来源 · {references.length}</h3>
      {references.length > 8 && <button type="button" onClick={() => setAll(!all)} className="text-xs text-primary">{all ? "收起" : "查看全部"}</button>}
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {(all ? references : references.slice(0, 8)).map((ref) => {
        const url = ref.url && /^https?:\/\//i.test(ref.url) ? ref.url : undefined;
        const Icon = ref.source_type === "web" ? Globe : FileText;
        return <article key={`${ref.ordinal}-${ref.source_id}`} data-source-citation={ref.ordinal}
          className={cn("rounded-xl border border-line p-3", active === ref.ordinal && "border-primary bg-primary-soft")}>
          <button type="button" onClick={() => jump(ref.ordinal, "text")} className="w-full text-left" aria-label={`定位正文引用 ${ref.ordinal}`}>
            <span className="text-xs text-primary">[{ref.ordinal}] <Icon className="inline size-3" /> {ref.source_type === "web" ? "网页" : "论文"}</span>
            <span className="mt-1 block line-clamp-2 text-[13px] font-medium">{ref.title}</span>
          </button>
          <p className="mt-1 truncate text-xs text-muted">{[ref.authors, ref.venue].filter(Boolean).join(" · ")}</p>
          {url && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary">打开来源 <ExternalLink className="size-3" /></a>}
        </article>;
      })}
    </div>
  </section>;
}
