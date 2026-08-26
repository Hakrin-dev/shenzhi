import type { ApiEnvelope } from "../../types/ai-search";
import { getAccessToken } from "./auth-token";

/** 浏览器一律打同源 `/api/v1`，由 Next 微后端转发到 FastAPI（BUSINESS_BACKEND_URL） */
export const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  code: number;
  status: number;

  constructor(code: number, message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function apiPath(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_PREFIX}${p}`;
}

export function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

// Serialize first contact so parallel config/history/upload requests cannot issue
// different anonymous cookies. This is transport bootstrap, not an account system.
let identityReady: Promise<void> | undefined;
async function ensureBackendIdentity() {
  if (typeof window === "undefined") return;
  identityReady ??= fetch(apiPath("/search/config"), { cache: "no-store", signal: AbortSignal.timeout(30000) }).then((response) => {
    if (!response.ok) throw new ApiError(20004, "无法连接生成服务", response.status);
  }).catch((error) => { identityReady = undefined; throw error; });
  await identityReady;
}

export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  await ensureBackendIdentity();
  const headers = authHeaders(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(apiPath(path), { ...init, headers, signal: init.signal ?? AbortSignal.timeout(30000) });
  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(
      20004,
      res.ok ? "响应无法解析" : `请求失败 (${res.status})`,
      res.status,
    );
  }

  if (!res.ok || !envelope || envelope.code !== 0 || envelope.data === undefined) {
    throw new ApiError(
      envelope?.code ?? 20004,
      envelope?.message || "生成服务暂不可用",
      res.status,
    );
  }

  return envelope.data;
}
