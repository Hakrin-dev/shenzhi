import type { ApiEnvelope } from "@/types/ai-search";
import { apiJson, apiPath, authHeaders } from "@/lib/api/http";

/**
 * UPDATE: 2026-08-20 C1 附件上传+解析接入
 *   - 本地 B 模式（NEXT_PUBLIC_AI_BACKEND_MODE != 'A'）时，
 *     上传走同源的 /api/uploads（C 模块自建的 uploads/route.ts），
 *     由服务端完成 PDF/TXT/MD 的解析并返回 { file_id, text }。
 *   - A 模式（='A'）时保持旧行为：/api/v1/uploads，由服务端转发到外部 API_URL。
 *   - 返回字段扩展：新增 UploadsDataFull.text / truncated / warning，
 *     供 attachment-menu → composer store 的 ChatAttachment.text/error 填充。
 *
 * 修改日志：任务日志/对于C的修改/2026.8.20-C模块-附件上传解析.md
 */

export interface UploadFileResult {
  file_id: string;
}

/** A 模块原有字段：/uploads/:fileId 状态查询返回 */
export interface UploadFileStatus {
  file_id: string;
  filename: string;
  parse_status: "pending" | "ok" | "failed";
}

/** C 模块 uploads/route.ts 返回的完整 data（B 模式专用） */
export interface UploadsDataFull extends UploadFileStatus {
  parse_status: "ok" | "failed";
  text?: string;
  truncated?: boolean;
  warning?: string;
}

/** 判断当前前端是否走 B 模式（本地单前端）—— C 模块能力只在 B 模式生效 */
function isLocalModeB(): boolean {
  const mode =
    (typeof process !== "undefined" && process.env
      ? (process.env as Record<string, string | undefined>)[
          "NEXT_PUBLIC_AI_BACKEND_MODE"
        ]
      : undefined) ??
    (typeof window !== "undefined"
      ? (window as unknown as { __NEXT_DATA__?: unknown }).__NEXT_DATA__
        ? undefined
        : undefined
      : undefined);
  // 严格判断：只有显式 = 'A' 时走代理；其余（= 'B' / undefined）走本地 C
  // 这样 .env.local 缺失 NEXT_PUBLIC_AI_BACKEND_MODE 时也能用 C
  return mode !== "A";
}

/**
 * B 模式专用 fetch：不携带 A 模块的 authHeaders（/api/uploads 是本地同源 route，
 * 没有 Authorization 逻辑；带 Bearer 也不会报错，但为了链路清晰我们用最小集合）
 */
async function uploadLocal(file: File): Promise<UploadsDataFull> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/uploads", {
    method: "POST",
    // multipart 不能手动写 Content-Type，交给浏览器自动加 boundary
    body,
  });
  let json: ApiEnvelope<UploadsDataFull> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<UploadsDataFull>;
  } catch (e) {
    throw new Error(
      res.ok
        ? `上传响应无法解析：${(e as Error).message}`
        : `上传失败 (${res.status})`,
    );
  }
  if (json?.code !== 0 || !json.data) {
    // 解析失败：code=20018 会把 data.parse_status="failed" 带 warning —— 也当成功返回，
    // 上游 attachment-menu 根据 parse_status 写回 ChatAttachment.error
    if (json?.data && (json.code === 20018 || !json.code)) {
      return json.data;
    }
    throw new Error(json?.message || "上传失败");
  }
  return json.data;
}

/** 上传单个文件：按 BACKEND_MODE 自动路由 */
export async function uploadFile(file: File): Promise<UploadsDataFull> {
  if (isLocalModeB()) {
    return uploadLocal(file);
  }
  // A 模式：走 /api/v1/uploads 代理 + authHeaders；把返回结果包装成 UploadsDataFull
  // （A 模式下 C 解析能力未接入，只保留旧 UploadFileResult：file_id）
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(apiPath("/uploads"), {
    method: "POST",
    headers: authHeaders(),
    body,
  });
  const json = (await res.json()) as {
    code: number;
    data?: UploadFileResult;
    message?: string;
  };
  if (json.code !== 0 || !json.data?.file_id) {
    throw new Error(json.message || "上传失败");
  }
  return {
    file_id: json.data.file_id,
    filename: file.name,
    parse_status: "ok",
  };
}

/** A 模块原有：/uploads/:fileId 状态查询（A 模式代理）—— B 模式一般用不到 */
export function getUploadStatus(fileId: string) {
  return apiJson<UploadFileStatus>(`/uploads/${fileId}`);
}
