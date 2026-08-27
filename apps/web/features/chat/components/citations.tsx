"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";

const CitationContext = createContext<{ active: number; jump: (id: number, target: "source" | "text") => void }>({ active: 0, jump: () => {} });

/** B's bidirectional citations, scoped to ONE assistant turn. */
export function CitationScope({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const jump = (id: number, target: "source" | "text") => {
    setActive(id);
    root.current?.querySelector(`[data-${target}-citation="${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return <CitationContext.Provider value={{ active, jump }}><div ref={root}>{children}</div></CitationContext.Provider>;
}

export const useCitation = () => useContext(CitationContext);

function CitationTag({ id }: { id: number }) {
  const { active, jump } = useCitation();
  return <button type="button" data-text-citation={id} aria-label={`查看参考来源 ${id}`}
    onClick={() => jump(id, "source")}
    className={`mx-0.5 align-super text-[10px] font-medium text-primary ${active === id ? "rounded bg-primary-soft ring-1 ring-primary" : ""}`}>
    [{id}]
  </button>;
}

export function citeText(text: string): ReactNode[] {
  return text.split(/(\[\d+\])/g).map((part, index) => /^\[\d+\]$/.test(part)
    ? <CitationTag key={index} id={Number(part.slice(1, -1))} /> : part);
}
