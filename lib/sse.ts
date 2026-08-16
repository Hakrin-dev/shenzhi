import { authHeaders } from "@/lib/api/http";

export interface SseEvent {
  id?: string;
  event: string;
  data: string;
}

/**
 * fetch + ReadableStream 解析 SSE（支持 Authorization、Last-Event-ID）。
 * 不要用 EventSource：无法带 Bearer。
 */
export async function readSseStream(
  url: string,
  options: {
    signal?: AbortSignal;
    lastEventId?: string;
    onEvent: (event: SseEvent) => void;
  },
): Promise<void> {
  const headers = authHeaders({ Accept: "text/event-stream" });
  if (options.lastEventId) headers.set("Last-Event-ID", options.lastEventId);

  const res = await fetch(url, { headers, signal: options.signal });
  if (!res.ok || !res.body) {
    throw new Error(`SSE 连接失败 (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushBlock = (block: string) => {
    const lines = block.split("\n");
    let id: string | undefined;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("id:")) id = line.slice(3).trim();
      else if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0 && !id) return;
    options.onEvent({ id, event, data: dataLines.join("\n") });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      if (part.trim()) flushBlock(part.replace(/\r/g, ""));
    }
  }

  if (buffer.trim()) flushBlock(buffer.replace(/\r/g, ""));
}
