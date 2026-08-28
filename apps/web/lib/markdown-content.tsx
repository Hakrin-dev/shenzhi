/**
 * lib/markdown-content.tsx — AI 回答正文 Markdown 渲染器（Task：Markdown/代码/公式）
 * ---------------------------------------------------------------------
 * 用 react-markdown + remark-gfm（表格/删除线/任务列表）+ remark-math + rehype-katex（公式）
 * 替换原来纯文本 + 手动 [n] 高亮的 CitationContent。
 *
 * 【与引用联动兼容】
 *  - 本组件必须在 <CitationProvider> 内使用；
 *  - 段落 / 列表项里的 `[n]` 仍复用 citations.tsx 的 withCitations() 转成 CitationTag，
 *    因此 ReferenceGrid 双向高亮、反向滚动（registerContentRoot）行为保持不变；
 *  - 顶层 <span ref> 注册为 contentRoot，供 jumpFromCard 反向滚动。
 */
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { useCitation, withCitations } from "@/lib/citations";

/** 把段落/列表项里的字符串 children 做 [n] 高亮（非字符串元素原样返回） */
function citeChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") return withCitations(child);
    return child;
  });
}

export function MarkdownContent({ text }: { text: string }) {
  const ctx = useCitation();
  const registerContentRoot = ctx.registerContentRoot;
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    registerContentRoot(ref.current);
    return () => registerContentRoot(null);
  }, [registerContentRoot]);

  return (
    <div ref={ref} className="markdown-body min-w-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-4 text-xl font-semibold leading-snug text-ink first:mt-0">
              {citeChildren(children)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2.5 mt-4 text-lg font-semibold leading-snug text-ink first:mt-0">
              {citeChildren(children)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-3 text-base font-semibold leading-snug text-ink first:mt-0">
              {citeChildren(children)}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-1.5 mt-2.5 text-sm font-semibold text-ink">
              {citeChildren(children)}
            </h4>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5 text-ink-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5 text-ink-2">{children}</ol>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          // 段落 + 列表项：识别 [n] 引用
          p: ({ children }) => (
            <p className="my-1.5 leading-7 text-ink-2 first:mt-0 last:mb-0">
              {citeChildren(children)}
            </p>
          ),
          li: ({ children }) => (
            <li className="leading-7">{citeChildren(children)}</li>
          ),
          // 代码：inline 无 language 类；block 有 language-xxx
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className || "");
            return isBlock ? (
              <code className={cn("font-mono text-[13px]", className)} {...props}>
                {children}
              </code>
            ) : (
              <code
                className="rounded bg-chip px-1.5 py-0.5 font-mono text-[12.5px] text-ink"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg bg-panel p-3 text-[13px] leading-relaxed text-ink ring-1 ring-line/60 dark:bg-card/80 dark:ring-line/40">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-line bg-sidebar px-3 py-1.5 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-line px-3 py-1.5">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-line" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
