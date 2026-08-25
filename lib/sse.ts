/**
 * 底层 SSE 流式读取器（对齐 A 模块实现）。
 * - 不用 EventSource（无法自定义请求头如 Bearer Token）
 * - 使用 fetch + ReadableStream 手动按标准 SSE 格式解析
 * - 支持 Last-Event-ID 断点续传（resume 场景）
 *
 * SSE 标准格式：
 *   id: <event-id>\n
 *   event: <event-name>\n
 *   data: <line-1>\n
 *   data: <line-2>\n
 *   \n   ← 空行分隔事件块
 */

import { DEFAULT_HEADERS, isHtmlResponse, makeNgrokError } from "@/lib/request";

export interface ReadSSEOptions {
  signal?: AbortSignal;
  /** 断点续传的 Last-Event-ID */
  lastEventId?: string;
  /** 自定义请求头（Authorization 等放这里） */
  headers?: Record<string, string>;
  /**
   * 事件回调：(eventName, payload, lastEventId) => void
   * eventName 对应 data: 之前最后一个 event: 行；缺省时为 "message"
   */
  onEvent: (
    event: string,
    data: string,
    lastEventId: string | null,
  ) => void | Promise<void>;
}

/**
 * 对 A 模块 readSseStream 的简化：不带 method/body 入参，
 * 由调用方用 new Request() 先拼好完整请求（包括 POST + JSON body）。
 * 这样既能 GET /search/messages/{id}/stream，也能 POST 任何带 body 的 SSE 端点。
 */
export async function readSSEStream(
  input: string | URL | Request,
  opts: ReadSSEOptions,
): Promise<void> {
  const { signal, lastEventId, headers: extraHeaders, onEvent } = opts;

  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    Accept: "text/event-stream, */*;q=0.8",
    ...(extraHeaders ?? {}),
  };
  if (lastEventId) headers["Last-Event-ID"] = lastEventId;

  // 把 headers 合并到用户已构造的 Request 上（若 input 是 Request）
  const base = input instanceof Request ? input : new Request(input);
  const req = new Request(base, {
    signal,
    headers: {
      ...Object.fromEntries(base.headers.entries()),
      ...headers,
    },
  });

  const res = await fetch(req);
  const rawCT = res.headers.get("content-type") ?? "";

  // ngrok HTML 拦截页检查
  if (res.status === 403 || /text\/html/i.test(rawCT)) {
    const t = await res.text().catch(() => "");
    if (isHtmlResponse(rawCT, t)) {
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
    throw new Error("浏览器不支持 ReadableStream，无法接收 SSE 响应");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let currentId: string | null = lastEventId ?? null;
  let currentEvent = "message";
  let currentData = "";

  const flush = async () => {
    // data 结尾的单个 \n 去掉（SSE data: 多行合并后最后一个 \n 是分隔符）
    const data = currentData.endsWith("\n")
      ? currentData.slice(0, -1)
      : currentData;
    // ⚠️ 关键：onEvent 抛错不能中断 SSE 流（否则会导致 fetch Abort + 整个流丢失）
    try {
      await onEvent(currentEvent, data, currentId);
    } catch (e) {
      console.warn("[sse] onEvent handler threw:", e);
    }
    currentEvent = "message";
    currentData = "";
  };

  try {
    while (!signal?.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 按 \n 逐行切，剩下最后一段（可能还没收尾）留 buffer
      let lineSep: number;
      while ((lineSep = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, lineSep);
        buffer = buffer.slice(lineSep + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1); // 兼容 \r\n

        if (line === "") {
          // 空行 → 事件分隔符
          await flush();
          continue;
        }
        if (line.startsWith(":")) {
          // 注释行，跳过（SSE 心跳）
          continue;
        }
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
        switch (field) {
          case "id":
            currentId = value;
            break;
          case "event":
            currentEvent = value || "message";
            break;
          case "data":
            currentData += value + "\n";
            break;
          case "retry":
            // 浏览器会自动处理重试间隔；这里忽略即可
            break;
          default:
            // 未知字段按 SSE 标准忽略
            break;
        }
      }
    }
  } finally {
    // 循环结束后如果还有未 flush 的 data，说明服务端最后未补空行，做一次兜底
    if (currentData) {
      try {
        await flush();
      } catch {
        /* ignore */
      }
    }
    reader.releaseLock();
  }
}
