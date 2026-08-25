/**
 * B 模块 —— 全局请求封装
 * 统一注入:
 *   1. ngrok-skip-browser-warning 头（解决免费 ngrok 拦截页）
 *   2. 自定义 User-Agent（备选方案）
 *   3. 响应检测: 如果返回 HTML（ngrok 拦截页），抛出可识别错误
 *
 * A / B / C 模块所有 fetch / 流式调用必须走这里。
 */

/** 默认全局请求头（解决 ngrok 拦截 + 鉴权占位） */
export const DEFAULT_HEADERS: Record<string, string> = {
  "ngrok-skip-browser-warning": "true",
  "User-Agent": "shenzhi-dev-frontend/1.0",
  Accept: "application/json, text/event-stream, */*;q=0.8",
};

/** 检测响应是否为 ngrok / CDN 拦截 HTML 页 */
export function isHtmlResponse(
  contentType: string | null,
  text?: string,
): boolean {
  if (contentType && /text\/html/i.test(contentType)) return true;
  if (text && /^\s*<!DOCTYPE html|<html/i.test(text.slice(0, 512))) return true;
  return false;
}

export interface NgrokInterceptError extends Error {
  name: "NgrokInterceptError";
  code: "NGROK_INTERCEPT" | "NGROK_403";
}

export function makeNgrokError(status: number): NgrokInterceptError {
  const err = new Error(
    status === 403
      ? "检测到 ngrok 安全拦截(403)，请先在浏览器打开目标页面手动点击「Visit Site」放行一次，或检查请求头是否携带 ngrok-skip-browser-warning。"
      : "接口返回了 HTML 拦截页而非 JSON/SSE，通常是 ngrok 免费版警告。请检查请求头并手动放行浏览器拦截页。",
  ) as NgrokInterceptError;
  err.name = "NgrokInterceptError";
  err.code = status === 403 ? "NGROK_403" : "NGROK_INTERCEPT";
  return err;
}

export interface ShenZhiFetchOptions extends RequestInit {
  /** 为 true 时跳过 ngrok HTML 检测（用于非 API 请求） */
  skipNgrokCheck?: boolean;
}

/**
 * 带 ngrok 防护的 fetch 包装。
 * 用法：const data = await shenzhiFetch<T>('/api/xxx', { method: 'POST', body: JSON.stringify(payload) })
 */
export async function shenzhiFetch<T = unknown>(
  input: string | URL | Request,
  init: ShenZhiFetchOptions = {},
): Promise<T> {
  const { skipNgrokCheck = false, headers: userHeaders, ...rest } = init;
  const req = new Request(input, {
    ...rest,
    headers: {
      ...DEFAULT_HEADERS,
      ...(userHeaders ?? {}),
    },
  });

  const res = await fetch(req);

  if (!res.ok && res.status === 403 && !skipNgrokCheck) {
    const t = await res.text().catch(() => "");
    if (isHtmlResponse(res.headers.get("content-type"), t)) {
      throw makeNgrokError(403);
    }
  }

  // 文本层检查拦截页
  const text = await res.text();
  if (!skipNgrokCheck && isHtmlResponse(res.headers.get("content-type"), text)) {
    throw makeNgrokError(res.status);
  }

  // 非 2xx 但也不是 HTML，就按原 JSON 抛出方便定位
  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : { message: `HTTP ${res.status}` };
    } catch {
      parsed = { message: text || `HTTP ${res.status}` };
    }
    const e = new Error(
      (parsed as { message?: string }).message || `HTTP ${res.status}`,
    );
    (e as Error & { code?: string; status?: number }).status = res.status;
    throw e;
  }

  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/**
 * SSE 流式读取器（兼容 Response.body ReadableStream）
 * 用法：
 *   const res = await fetchSSE('/api/b/ai/chat', { body: JSON.stringify(payload) })
 *   for await (const ev of res.events) { ... }
 */
export async function fetchSSE(
  input: string | URL | Request,
  init: ShenZhiFetchOptions = {},
) {
  const { headers: userHeaders, ...rest } = init;
  const req = new Request(input, {
    ...rest,
    headers: {
      ...DEFAULT_HEADERS,
      Accept: "text/event-stream, */*;q=0.8",
      ...(userHeaders ?? {}),
    },
  });

  const res = await fetch(req);

  // 403 / HTML 拦截检查
  const rawContentType = res.headers.get("content-type") ?? "";
  if (res.status === 403 || /text\/html/i.test(rawContentType)) {
    const t = await res.text().catch(() => "");
    if (isHtmlResponse(rawContentType, t)) {
      throw makeNgrokError(res.status);
    }
    if (!res.ok) {
      const e = new Error(t || `HTTP ${res.status}`);
      (e as Error & { status?: number }).status = res.status;
      throw e;
    }
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    const e = new Error(t || `HTTP ${res.status}`);
    (e as Error & { status?: number }).status = res.status;
    throw e;
  }

  if (!res.body) {
    throw new Error("浏览器不支持 ReadableStream，无法接收流式响应");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let stopped = false;

  const stop = () => {
    stopped = true;
    reader.cancel().catch(() => {});
  };

  async function* events(): AsyncGenerator<string, void, unknown> {
    try {
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done || stopped) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE 以空行分隔事件
        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          // data: 行；多行合并
          let data = "";
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data:")) {
              data += line.slice(5).replace(/^ /, "");
            }
          }
          if (data) yield data;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  return {
    response: res,
    events: events(),
    stop,
  };
}
