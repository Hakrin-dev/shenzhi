import { ApiError } from "@/clients/backend/http";

export function messageForApiError(error: unknown) {
  if (error instanceof ApiError) return error.message || "生成服务暂不可用";
  if (error instanceof Error) return error.message;
  return "生成服务暂不可用";
}
