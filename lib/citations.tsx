/**
 * lib/citations.tsx — 引用 [n] 双向联动系统
 * ======================================================================
 * 【需求来源 · 第二阶段 N.5 收尾 Task 2】
 * 验收标准：正文中的每个 [n] 必须能点击跳转到 ReferenceGrid 对应卡片并高亮；
 *           点击 ReferenceGrid 卡片必须反向把正文中的对应 [n] 标红高亮。
 *
 * 【设计】
 *  用 React Context（<CitationProvider>）在"同一条助手消息"作用域里传递：
 *    - activeCitation: number | null     当前高亮的引用序号
 *    - setActiveCitation: (n) => void    设置
 *    - jumpToCard(n): void               正文 [n] 点击：滚动到 ReferenceGrid + 高亮 n
 *    - jumpFromCard(n): void             卡片点击：反向高亮 [n]
 *    - cardsRef: ReactRef                ReferenceGrid 容器 DOM（scrollIntoView 用）
 *    - contentRef: ReactRef              正文容器 DOM（反向 scrollIntoView 首 [n] 用）
 *
 *  配套组件：
 *    <CitationContent text={content} />  — 正文渲染器，里面每个 [n] 渲染成 <button>
 *    <CitationTag n={num} />            — 单个 [n] 上标按钮（共享 activeCitation 判断）
 *
 *  父组件（agent-chat）每条助手消息的气泡外层包：
 *    <CitationProvider key={msg.id}>
 *      <CitationContent text={msg.content} />
 *      <ReferenceGrid sources={msg.sources} />  ← 里面读 Context 做高亮
 *    </CitationProvider>
 */

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/* ============================================================
   Context
   ============================================================ */
interface CitationContextValue {
  /** 当前激活的引用序号（从正文点、或从卡点击来） */
  activeCitation: number | null;
  /** 双向设置：null = 清除 */
  setActiveCitation: (n: number | null) => void;
  /**
   * 正文 [n] 点击调用：
   *   ① 激活引用 n（= setActiveCitation(n)）
   *   ② 滚动 ReferenceGrid 容器到可视范围 + 给目标卡片 focus ring
   */
  jumpFromContent: (n: number) => void;
  /**
   * ReferenceGrid 卡片点击调用：
   *   ① 激活引用 n
   *   ② 滚动正文首处 [n] 标签到可视范围（smooth）+ 闪烁
   */
  jumpFromCard: (n: number) => void;
  /** ReferenceGrid 容器注册（用于 scrollIntoView） */
  registerCardsRoot: (el: HTMLElement | null) => void;
  /** 正文容器注册（用于反向 scroll） */
  registerContentRoot: (el: HTMLElement | null) => void;
  /** 每个 [n] 按钮用 id 前缀（React useId 生成，保证 SSR 一致） */
  scopeId: string;
}

const CitationContext = createContext<CitationContextValue | null>(null);

export function useCitation(): CitationContextValue {
  const ctx = useContext(CitationContext);
  // 未被 Provider 包裹 → 返回一个 noop 实现（让 withCitations 单测 / 其他调用方
  // 不包 Provider 也能正常显示样式，只是缺联动 —— 比抛错更宽容）
  if (!ctx) {
    return NOOP_CTX;
  }
  return ctx;
}

const NOOP_CTX: CitationContextValue = {
  activeCitation: null,
  setActiveCitation: () => {},
  jumpFromContent: () => {},
  jumpFromCard: () => {},
  registerCardsRoot: () => {},
  registerContentRoot: () => {},
  scopeId: "citation-noop",
};

/* ============================================================
   Provider
   ============================================================ */
export function CitationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeCitation, setActiveCitation] = useState<number | null>(null);
  const cardsRootRef = useRef<HTMLElement | null>(null);
  const contentRootRef = useRef<HTMLElement | null>(null);
  const scopeId = useId();

  const registerCardsRoot = useCallback((el: HTMLElement | null) => {
    cardsRootRef.current = el;
  }, []);
  const registerContentRoot = useCallback((el: HTMLElement | null) => {
    contentRootRef.current = el;
  }, []);

  const jumpFromContent = useCallback((n: number) => {
    setActiveCitation(n);
    // ① 找 ReferenceGrid 卡片（用 scopeId 保证隔离）
    const root = cardsRootRef.current;
    if (root) {
      root.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const card = root.querySelector<HTMLElement>(`[data-citation-id="${n}"]`);
      card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      // flash：临时加 pulse 动画（浏览器原生 focus 也可）
      card?.classList.add("animate-pulse");
      setTimeout(() => card?.classList.remove("animate-pulse"), 900);
    }
  }, []);

  const jumpFromCard = useCallback((n: number) => {
    setActiveCitation(n);
    const root = contentRootRef.current;
    if (!root) return;
    const tags = root.querySelectorAll<HTMLElement>(`[data-citation-id="${n}"]`);
    if (tags.length === 0) return;
    // 第一处 [n] 滚入视野
    tags[0].scrollIntoView({ behavior: "smooth", block: "center" });
    tags.forEach((el) => {
      el.classList.add("animate-pulse");
      setTimeout(() => el.classList.remove("animate-pulse"), 900);
    });
  }, []);

  const value = useMemo<CitationContextValue>(
    () => ({
      activeCitation,
      setActiveCitation,
      jumpFromContent,
      jumpFromCard,
      registerCardsRoot,
      registerContentRoot,
      scopeId,
    }),
    [activeCitation, jumpFromContent, jumpFromCard, registerCardsRoot, registerContentRoot, scopeId],
  );

  return (
    <CitationContext.Provider value={value}>
      {children}
    </CitationContext.Provider>
  );
}

/* ============================================================
   CitationTag — 单个 [n] 上标按钮（正文内用）
   ============================================================ */
export function CitationTag({ n }: { n: number }) {
  const ctx = useCitation();
  const isActive = ctx.activeCitation === n;
  return (
    <button
      type="button"
      data-citation-id={n}
      aria-label={`跳转到引用 ${n}`}
      onClick={(e) => {
        e.stopPropagation();
        ctx.jumpFromContent(n);
      }}
      // 失焦时清空 activeCitation（用户点空白 → 自动取消高亮；可选行为）
      onBlur={() => {
        // 给反向高亮的卡片 / 其他 [n] 一个缓冲时间；不要点完就清
      }}
      className={cn(
        "mx-0.5 inline-flex cursor-pointer select-none items-center justify-center rounded-md px-1 font-semibold align-super text-[10.5px] leading-none no-underline transition-all duration-150",
        isActive
          ? "bg-primary text-primary-foreground shadow-[0_0_0_2px_rgba(79,70,229,0.25)] scale-110"
          : "bg-primary/10 text-primary hover:bg-primary/20 hover:underline-offset-2",
      )}
    >
      {n}
    </button>
  );
}

/* ============================================================
   CitationContent — 正文渲染器（把 [n] 分割成 ReactNode）
   替换旧 withCitations(text): ReactNode[]
   ============================================================ */
export function CitationContent({ text }: { text: string }) {
  const ctx = useCitation();
  const registerContentRoot = ctx.registerContentRoot;
  const ref = React.useRef<HTMLSpanElement | null>(null);
  React.useEffect(() => {
    registerContentRoot(ref.current);
    return () => registerContentRoot(null);
  }, [registerContentRoot]);

  const nodes = React.useMemo(() => {
    if (!text) return [text ?? ""];
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, i) => {
      const m = /^\[(\d+)\]$/.exec(part);
      if (m) {
        const n = Number.parseInt(m[1], 10);
        // 保证稳定性 key：前缀 + 位置 + n
        return <CitationTag key={`${ctx.scopeId}-p${i}-n${n}`} n={n} />;
      }
      return <span key={`${ctx.scopeId}-p${i}`}>{part}</span>;
    });
  }, [text, ctx.scopeId]);

  return (
    <span ref={ref} className="contents">
      {nodes}
    </span>
  );
}

/**
 * 向后兼容：旧代码 `withCitations(text)` 直接返回 ReactNode 数组（不包 Provider、
 * 不联动 ReferenceGrid，但渲染样式与原一致）。用于非聊天正文的 [n] 渲染场景。
 * 新代码（agent-chat 助手消息）请直接用 CitationProvider + CitationContent。
 */
export function withCitations(text: string): React.ReactNode[] {
  if (!text) return [""];
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = /^\[(\d+)\]$/.exec(part);
    if (m) return <CitationTag key={`wc-${i}-${m[1]}`} n={Number.parseInt(m[1], 10)} />;
    return <span key={`wc-${i}`}>{part}</span>;
  });
}
