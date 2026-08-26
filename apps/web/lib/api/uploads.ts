import { apiJson, apiPath, authHeaders } from "@/lib/api/http";

const AI_BACKEND_MODE: "A" | "B" =
  (process.env.NEXT_PUBLIC_AI_BACKEND_MODE as "A" | "B" | undefined) === "A"
    ? "A"
    : "B";

export interface UploadFileResult {
  file_id: string;
  filename: string;
  parse_status: "ok" | "failed";
  text?: string;
  truncated?: boolean;
  originalLength?: number;
  finalLength?: number;
  warning?: string;
  warningCode?: "ATTACHMENT_TRUNCATED_30K" | "ATTACHMENT_OVERALL_TRUNCATED_60K";
}

export interface UploadFileStatus {
  file_id: string;
  filename: string;
  parse_status: "pending" | "ok" | "failed";
}

function uploadPath(): string {
  return AI_BACKEND_MODE === "B" ? "/api/b/uploads" : apiPath("/uploads");
}

export async function uploadFile(file: File): Promise<UploadFileResult> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(uploadPath(), {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body,
  });
  const json = (await res.json()) as {
    code: number;
    data?: UploadFileResult & { filename?: string };
    message?: string;
  };

  if (res.status === 401 || json.code === 401) {
    throw new Error(json.message || "请先登录后再上传附件");
  }
  if (json.code !== 0 || !json.data?.file_id) {
    throw new Error(json.message || "上传失败");
  }

  const data = json.data;
  return {
    file_id: data.file_id,
    filename: data.filename ?? file.name,
    parse_status: data.parse_status ?? "ok",
    text: data.text,
    truncated: data.truncated,
    originalLength: data.originalLength,
    finalLength: data.finalLength,
    warning: data.warning,
    warningCode: data.warningCode,
  };
}

export function getUploadStatus(fileId: string) {
  return apiJson<UploadFileStatus>(`/uploads/${fileId}`);
}
