/**
 * C 模块 · 文档解析服务端库（仅在 Next.js Server Route 内调用）
 * 支持：PDF / TXT / Markdown 纯文本提取
 *
 * 设计原则：
 *   1. 不落磁盘（可选：调用方如需落盘 tmp_uploads/，自行处理）
 *   2. 出错时抛带有中文 message 的 ParseError，上游 route 包成 ApiEnvelope
 *   3. PDF 解析失败 → 降级为「前 10KB 二进制转 hex」？不 —— 直接抛错提示用户重传
 *
 * 依赖：
 *   - pdf-parse（纯 JS；Windows 下无需 native binding）
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";
import {
  MAX_PARSE_CHARS_PER_FILE,
  MAX_PARSE_CHARS_TOTAL,
} from "@/lib/constants";
// pdf-parse@2.x 暴露 class `PDFParse`，不再提供 default 导出。
// 兼容旧版 `pdfParse(buffer)` 函数式用法：把 Buffer 数据塞进实例后调用 getText()。

// ⚠️ 修复（2026.8.21 验收发现）：pdfjs-dist 在 Node 下默认用 fake worker，
//   Turbopack 打包时把 pdfjs 内部的动态 import 重写为 chunk 相对路径，导致
//   Cannot find module '.next/dev/server/chunks/pdf.worker.mjs'。
//   双保险方案：
//   ① PDFParse.setWorker(workerUrl) —— 把 GlobalWorkerOptions.workerSrc 指向
//      pdf.worker.mjs 的 file:// 绝对 URL（pdfjs 源码自带 webpackIgnore，Node 直接加载文件）；
//   ② 同时注入 globalThis.pdfjsWorker —— fake worker 会优先复用主线程 handler，彻底绕开动态 import。
let pdfjsSetupPromise: Promise<void> | null = null;
function ensurePdfjsWorker(): Promise<void> {
  if (!pdfjsSetupPromise) {
    pdfjsSetupPromise = (async () => {
      try {
        const pnpmDir = path.join(process.cwd(), "node_modules", ".pnpm");
        const entry = fs
          .readdirSync(pnpmDir)
          .find((d) => d.startsWith("pdfjs-dist@"));
        const workerPath = entry
          ? path.join(
              pnpmDir,
              entry,
              "node_modules",
              "pdfjs-dist",
              "legacy",
              "build",
              "pdf.worker.mjs",
            )
          : "";
        if (!workerPath || !fs.existsSync(workerPath)) return;
        const workerUrl = pathToFileURL(workerPath).href;
        // ① 给 GlobalWorkerOptions.workerSrc 注入 file:// URL
        PDFParse.setWorker(workerUrl);
        // ② 注入主线程 handler（fake worker 直接复用，不再动态 import）
        const workerMod = await import(
          /* webpackIgnore: true */
          /* @vite-ignore */
          workerUrl
        );
        (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = workerMod;
      } catch (e) {
        console.warn(
          "[C] pdfjs worker 注入失败（PDF 解析可能不可用）:",
          e instanceof Error ? e.message : String(e),
        );
      }
    })();
  }
  return pdfjsSetupPromise;
}

async function pdfParseLegacy(
  buffer: Buffer,
): Promise<{ text: string; numpages?: number; info?: unknown }> {
  await ensurePdfjsWorker();
  const inst = new PDFParse({ data: buffer });
  try {
    const res = await inst.getText();
    return { text: res.text ?? "", info: undefined };
  } finally {
    await inst.destroy().catch(() => {});
  }
}

export type ParseDocType = "pdf" | "txt" | "md";

export class ParseError extends Error {
  override name = "ParseError";
  constructor(message: string) {
    super(message);
  }
}

/** 单附件提取文本的长度上限（防 DeepSeek 上下文爆炸）
 * UPDATE: 2026-08-21 · 真实值挪到 lib/constants.ts，这里仅保留 re-export，
 * 避免 client chat-prompt 间接引入 node:fs（Build 会崩）。
 */
export { MAX_PARSE_CHARS_PER_FILE, MAX_PARSE_CHARS_TOTAL } from "@/lib/constants";

/** 解析结果：包含截断状态 / 原始字数 / 告警码（用于「思考面板告警」展示） */
export interface ParseResult {
  text: string;
  /** 规范化后的原始字数（截断前） */
  originalLength: number;
  /** 最终返回字数（可能被单附件 3 万字截断） */
  finalLength: number;
  /** 是否触发了单附件硬截断 */
  truncatedPerFile: boolean;
  /** 中文告警（单附件过长 → 思考面板可直接展示；多附件聚合在 buildAttachmentContext 里算） */
  warning?: string;
  /** 机器可读告警码：ATTACHMENT_TRUNCATED_30K */
  warningCode?: "ATTACHMENT_TRUNCATED_30K";
}

function extOf(filename: string): ParseDocType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  return null;
}

function normalizeExt(filename: string, extHint?: ParseDocType): ParseDocType {
  const fromName = extOf(filename);
  const ext = fromName ?? extHint;
  if (!ext) {
    throw new ParseError(
      `不支持的文件类型：${filename}。仅支持 .pdf / .txt / .md`,
    );
  }
  return ext;
}

/**
 * 对外统一入口：从 Buffer + 文件名提取纯文本
 * @param buffer    文件内容 Buffer
 * @param filename  原始文件名（用于判断扩展名 + 错误信息）
 * @param extHint   可选扩展名兜底（某些浏览器上传场景 filename 不带扩展名时使用）
 * @returns ParseResult 结构化解析结果（含截断状态 / 字数 / 告警码）
 */
export async function parseDocument(
  buffer: Buffer,
  filename: string,
  extHint?: ParseDocType,
): Promise<ParseResult> {
  const ext = normalizeExt(filename, extHint);
  let raw: string;
  try {
    switch (ext) {
      case "pdf":
        raw = (await pdfParseLegacy(buffer)).text;
        break;
      case "txt":
      case "md":
        raw = buffer.toString("utf-8");
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ParseError(`${ext.toUpperCase()} 解析失败：${msg}`);
  }

  // 规范化：CRLF → LF；三连换行 → 两连
  const normalized = raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const originalLength = normalized.length;
  if (originalLength === 0) {
    throw new ParseError("提取文本为空，可能是扫描版 PDF（仅支持文字版 PDF / TXT / MD）");
  }

  // 单附件硬截断：3 万字
  const truncatedPerFile = originalLength > MAX_PARSE_CHARS_PER_FILE;
  const text = truncatedPerFile
    ? normalized.slice(0, MAX_PARSE_CHARS_PER_FILE)
    : normalized;
  const finalLength = text.length;

  const warning = truncatedPerFile
    ? `附件「${filename}」过长（${originalLength.toLocaleString()} 字），已截断至前 ${MAX_PARSE_CHARS_PER_FILE.toLocaleString()} 字（单附件上限 3 万字 / 多附件合计 6 万字，防止上下文溢出）。`
    : undefined;

  return {
    text,
    originalLength,
    finalLength,
    truncatedPerFile,
    warning,
    warningCode: truncatedPerFile ? "ATTACHMENT_TRUNCATED_30K" : undefined,
  };
}

/**
 * 兼容旧版用法：`if (isTruncated(text.length))` 这种判断逻辑已不可靠（因为
 * 现在 parseDocument 返回的 finalLength 最大等于 MAX_PARSE_CHARS_PER_FILE，
 * 无法从 text 长度反推是否截断。请使用 ParseResult.truncatedPerFile 字段。
 * 保留仅为了后向兼容已有 `uploads/route.ts` 调用（现已升级为读 ParseResult）。
 * @deprecated 使用 ParseResult.truncatedPerFile
 */
export function isTruncated(textOrLength: string | number): boolean {
  const len = typeof textOrLength === "string" ? textOrLength.length : textOrLength;
  return len >= MAX_PARSE_CHARS_PER_FILE;
}
