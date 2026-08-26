import { apiJson, apiPath, authHeaders } from "@/clients/backend/http";

export interface UploadFileResult {
  file_id: string;
}

export interface UploadFileStatus {
  file_id: string;
  filename: string;
  parse_status: "pending" | "ok" | "failed";
}

export async function uploadFile(file: File) {
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
  return json.data;
}

export function getUploadStatus(fileId: string) {
  return apiJson<UploadFileStatus>(`/uploads/${fileId}`);
}
