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

/** 单附件提取文本的长度上限（防 DeepSeek 上下文爆炸） */
export const MAX_PARSE_CHARS_PER_FILE = 30_000;

/** 总附件提取文本的上限（所有附件拼 Prompt 时再截断） */
export const MAX_PARSE_CHARS_TOTAL = 60_000;

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
 * @returns 提取后的纯文本（长度已经按 MAX_PARSE_CHARS_PER_FILE 截断）
 */
export async function parseDocument(
  buffer: Buffer,
  filename: string,
  extHint?: ParseDocType,
): Promise<string> {
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

  // 统一走长度截断（在 route 里再把截断状态写到 Envelope 的 warning 字段）
  const trimmed = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (trimmed.length === 0) {
    throw new ParseError("提取文本为空，可能是扫描版 PDF（仅支持文字版 PDF / TXT / MD）");
  }
  if (trimmed.length > MAX_PARSE_CHARS_PER_FILE) {
    return trimmed.slice(0, MAX_PARSE_CHARS_PER_FILE);
  }
  return trimmed;
}

export function isTruncated(text: string): boolean {
  return text.length >= MAX_PARSE_CHARS_PER_FILE;
}
