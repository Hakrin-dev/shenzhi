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

/* =========================================================
 *  LaTeX 自动包裹：把裸漏的 LaTeX 命令（\mathbf, \mathcal 等）
 *  自动包上 $...$，让 remark-math + rehype-katex 能正确渲染。
 *  只处理行内公式，且已有 $ 包裹的不重复处理。
 * ======================================================= */

/** 常见的 LaTeX 命令前缀（行内公式中高频出现） */
const LATEX_CMDS = [
  "\\mathbf",
  "\\mathcal",
  "\\mathrm",
  "\\mathit",
  "\\boldsymbol",
  "\\alpha",
  "\\beta",
  "\\gamma",
  "\\delta",
  "\\epsilon",
  "\\varepsilon",
  "\\theta",
  "\\lambda",
  "\\mu",
  "\\pi",
  "\\sigma",
  "\\tau",
  "\\phi",
  "\\varphi",
  "\\omega",
  "\\Delta",
  "\\Theta",
  "\\Lambda",
  "\\Pi",
  "\\Sigma",
  "\\Omega",
  "\\nabla",
  "\\partial",
  "\\infty",
  "\\approx",
  "\\neq",
  "\\leq",
  "\\geq",
  "\\cdot",
  "\\times",
  "\\div",
  "\\pm",
  "\\sum",
  "\\prod",
  "\\int",
  "\\lim",
  "\\log",
  "\\ln",
  "\\sin",
  "\\cos",
  "\\tan",
  "\\sqrt",
  "\\frac",
  "\\hat",
  "\\bar",
  "\\tilde",
  "\\dot",
  "\\ddot",
  "\\sim",
  "\\simeq",
  "\\equiv",
  "\\propto",
  "\\in",
  "\\notin",
  "\\subset",
  "\\supset",
  "\\subseteq",
  "\\supseteq",
  "\\cup",
  "\\cap",
  "\\setminus",
  "\\emptyset",
  "\\mathbb",
  "\\mathcal",
  "\\mathfrak",
  "\\mathsf",
  "\\mathtt",
  "\\langle",
  "\\rangle",
  "\\lceil",
  "\\rceil",
  "\\lfloor",
  "\\rfloor",
  "\\to",
  "\\rightarrow",
  "\\leftarrow",
  "\\Rightarrow",
  "\\Leftarrow",
  "\\leftrightarrow",
  "\\Leftrightarrow",
  "\\mapsto",
  "\\implies",
  "\\iff",
  "\\bot",
  "\\top",
  "\\neg",
  "\\land",
  "\\lor",
  "\\forall",
  "\\exists",
  "\\therefore",
  "\\because",
];

/**
 * 判断一段文本是否是"裸 LaTeX"（包含 LaTeX 命令但没有被 $ 包裹）。
 * 匹配规则：文本中出现 `\cmd` 形式的 LaTeX 命令，且整段不在 $...$ 内。
 */
function detectNakedLatex(text: string): boolean {
  // 已经有 $ 包裹的跳过
  if (/\$[^$]+\$/.test(text)) return false;
  // 检查是否包含任意 LaTeX 命令
  for (const cmd of LATEX_CMDS) {
    if (text.includes(cmd)) return true;
  }
  return false;
}

/**
 * 给裸露的 LaTeX 片段包裹 $...$
 * 策略：逐行扫描，对每一行中包含 LaTeX 命令且未被 $ 包裹的连续片段加 $
 * 简单处理：如果一行里有 LaTeX 命令但没有 $，就在整行内所有 LaTeX 表达式两端加 $
 */
function wrapNakedLatex(text: string): string {
  // 已有任何 $ 公式标记 → 认为模型已正确处理，不做兜底（避免干扰）
  if (/\$/.test(text)) return text;

  const lines = text.split("\n");
  const result: string[] = [];
  let hasAnyLatex = false;

  for (const line of lines) {
    // 代码块、表格、列表标记等跳过
    if (/^```/.test(line.trim()) || /^\s*\|/.test(line.trim())) {
      result.push(line);
      continue;
    }

    // 检测是否有 LaTeX 命令
    if (!detectNakedLatex(line)) {
      result.push(line);
      continue;
    }

    hasAnyLatex = true;

    // 找到所有连续的 LaTeX 表达式并包裹 $
    // 匹配 \cmd 开头，后跟花括号、下标、上标、数字、字母、常见运算符
    const wrapped = line.replace(
      /(\\[a-zA-Z]+(?:\{[^}]*\}|_[^{}\s]+|\^[^{}\s]+|[\w(),;.\-+*/=<>{}[\]\\|'~`!@#$%^&:?"]*)*)/g,
      (match) => {
        if (match.startsWith("$")) return match;
        return `$${match}$`;
      },
    );

    result.push(wrapped);
  }

  // 完全没检测到 LaTeX 就返回原文，避免不必要修改
  if (!hasAnyLatex) return text;
  return result.join("\n");
}

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

  // 预处理：给裸露的 LaTeX 命令包裹 $，确保 KaTeX 能正确渲染
  const processedText = React.useMemo(() => wrapNakedLatex(text), [text]);

  return (
    <div ref={ref} className="markdown-body min-w-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // 段落 + 列表项：识别 [n] 引用
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{citeChildren(children)}</p>,
          li: ({ children }) => <li>{citeChildren(children)}</li>,
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
        {processedText}
      </ReactMarkdown>
    </div>
  );
}
