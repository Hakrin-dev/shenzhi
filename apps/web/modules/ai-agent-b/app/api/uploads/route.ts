/**
 * C 模块 · 本地上传 + 文档解析 Server Route（POST /api/uploads）
 *
 * 接入点：
 *   - 前端 attachment-menu → lib/api/uploads.ts → BACKEND_MODE=B 时走本 route
 *   - BACKEND_MODE=A 时，uploads.ts 仍走 /api/v1/uploads 代理（服务端转发到外部 API_URL）
 *
 * 流程：
 *   1. 接收 multipart/form-data，字段名 "file"（单选一个文件一次请求）
 *   2. 校验 扩展名 ∈ {.pdf,.txt,.md} 且 单文件 ≤ 20MB（默认值 与 composer config 对齐）
 *   3. 直接 Buffer → parseDocument() 提取纯文本（不落盘；省 I/O + 保密）
 *   4. 构造 file_id = crypto random 12 位
 *   5. 返回 A 模块 ApiEnvelope 格式：
 *        {code:0, data:{file_id, filename, parse_status:"ok"|"failed", text:string, truncated:boolean, warning?:string}}
 *      失败时 {code:非0, message:"中文说明"}
 *
 * 安全：
 *   - 解析文本通过 HTTPS /api/uploads 直接返回前端，前端再塞进 composer store 的 ChatAttachment.text
 *     （本阶段不做服务端持久化 —— 避免用户涉密文档落磁盘；如果第二阶段要做 RAG，再接入向量库）
 *   - 绝对不返回解析失败的原始二进制内容
 */

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import type { ApiEnvelope } from "@b/types/ai-search";
import {
  parseDocument,
  ParseError,
} from "@b/lib/c-server/parse-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES_PER_FILE = 20 * 1024 * 1024; // 20MB（与 config.upload.max_size_mb=20 对齐）
const ACCEPT_EXT_LOWER = new Set([
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
]);

interface UploadsData {
  file_id: string;
  filename: string;
  parse_status: "ok" | "failed";
  text?: string;
  /** 单附件是否被 3 万字硬截断（对应 ATTACHMENT_TRUNCATED_30K） */
  truncated?: boolean;
  /** 原始字数（截断前） */
  originalLength?: number;
  /** 返回字数（截断后） */
  finalLength?: number;
  /** 中文告警文案（可直接展示） */
  warning?: string;
  /** 机器可读告警码：ATTACHMENT_TRUNCATED_30K | ATTACHMENT_OVERALL_TRUNCATED_60K */
  warningCode?: "ATTACHMENT_TRUNCATED_30K" | "ATTACHMENT_OVERALL_TRUNCATED_60K";
}

function envelope<T>(code: number, rest: { data?: T; message?: string }): ApiEnvelope<T> {
  return { code, ...rest };
}

function fail(code: number, message: string, status = 400) {
  return NextResponse.json<ApiEnvelope<never>>(envelope(code, { message }), {
    status,
  });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return fail(20011, `表单解析失败：${(e as Error).message}`, 400);
  }

  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return fail(20012, "缺少 file 字段（multipart/form-data 字段名必须是 file）", 400);
  }
  const f = file as File;
  if (!(f as File).name) {
    return fail(20013, "上传文件缺少文件名", 400);
  }
  const filename = (f as File).name;

  // 1. 扩展名校验
  const lowerName = filename.toLowerCase();
  const hasAllowedExt = [...ACCEPT_EXT_LOWER].some((e) => lowerName.endsWith(e));
  if (!hasAllowedExt) {
    return fail(
      20014,
      `不支持的文件类型：${filename}。仅支持 .pdf / .txt / .md / .markdown`,
      415,
    );
  }

  // 2. 大小校验
  if (f.size > MAX_BYTES_PER_FILE) {
    return fail(
      20015,
      `文件过大：${(f.size / 1024 / 1024).toFixed(2)}MB，上限 ${MAX_BYTES_PER_FILE / 1024 / 1024}MB`,
      413,
    );
  }
  if (f.size === 0) {
    return fail(20016, "上传文件为空", 400);
  }

  // 3. 提取 Buffer（Next App Router 下 Blob → ArrayBuffer → Buffer）
  let buffer: Buffer;
  try {
    const ab = await f.arrayBuffer();
    buffer = Buffer.from(ab);
  } catch (e) {
    return fail(20017, `读取文件内容失败：${(e as Error).message}`, 500);
  }

  // 4. 解析文档（升级为 ParseResult：含截断状态 / 字数 / 告警码）
  const file_id = randomBytes(12).toString("hex");
  let result: Awaited<ReturnType<typeof parseDocument>>;
  try {
    result = await parseDocument(buffer, filename);
  } catch (e) {
    const message = e instanceof ParseError ? e.message : `解析失败：${(e as Error).message}`;
    return NextResponse.json<ApiEnvelope<UploadsData>>(
      envelope(20018, {
        data: {
          file_id,
          filename,
          parse_status: "failed",
          warning: message,
        },
        message,
      }),
      { status: 422 },
    );
  }

  return NextResponse.json<ApiEnvelope<UploadsData>>(
    envelope(0, {
      data: {
        file_id,
        filename,
        parse_status: "ok",
        text: result.text,
        truncated: result.truncatedPerFile,
        originalLength: result.originalLength,
        finalLength: result.finalLength,
        warning: result.warning,
        warningCode: result.warningCode,
      },
    }),
    { status: 200 },
  );
}
