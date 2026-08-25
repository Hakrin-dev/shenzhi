/**
 * lib/api/sessions.ts — 历史会话前端 API 客户端（第二阶段 P1 Task 14/15）
 * ---------------------------------------------------------------------
 * 直接打同源 /api/sessions（鉴权走 NextAuth session cookie，非 Bearer token）。
 * 响应统一 ApiEnvelope { code, message, data }；code=0 成功，否则抛 SessionApiError。
 * 匿名用户调用会得到 401 —— 上层应静默降级（不持久化 / 历史列表提示登录）。
 */
import type { ChatAttachment, ChatSource } from "@/types";

/* ---------------- 类型 ---------------- */

export interface SessionListItem {
  id: string;
  title: string;
  model: string;
  style: string;
  webSearch: boolean;
  attachments: unknown;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface SessionDetail {
  id: string;
  title: string;
  model: string;
  style: string;
  webSearch: boolean;
  attachments: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinkingContent?: string | null;
  sources?: unknown;
  createdAt: string;
}

export interface CreateSessionInput {
  title?: string;
  model?: string;
  style?: string;
  webSearch?: boolean;
  attachments?: ChatAttachment[];
}

export class SessionApiError extends Error {
  code: number;
  status: number;
  constructor(code: number, message: string, status = 400) {
    super(message);
    this.name = "SessionApiError";
    this.code = code;
    this.status = status;
  }
}

/* ---------------- 基础请求 ---------------- */

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new SessionApiError(20004, "网络异常，无法连接会话服务", 0);
  }
  let envelope: { code: number; message: string; data: T } | null = null;
  try {
    envelope = (await res.json()) as { code: number; message: string; data: T };
  } catch {
    throw new SessionApiError(20004, "会话服务响应无法解析", res.status);
  }
  if (!envelope || envelope.code !== 0) {
    throw new SessionApiError(
      envelope?.code ?? res.status,
      envelope?.message || "会话服务暂不可用",
      res.status,
    );
  }
  return envelope.data;
}

/* ---------------- 会话 CRUD ---------------- */

export async function listSessions(): Promise<SessionListItem[]> {
  return req<SessionListItem[]>("/api/sessions");
}

export async function createSession(input: CreateSessionInput = {}): Promise<{ id: string }> {
  return req<{ id: string }>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getSession(id: string): Promise<SessionDetail> {
  return req<SessionDetail>(`/api/sessions/${id}`);
}

export async function renameSession(id: string, title: string): Promise<{ id: string; title: string }> {
  return req<{ id: string; title: string }>(`/api/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deleteSession(id: string): Promise<{ id: string }> {
  return req<{ id: string }>(`/api/sessions/${id}`, { method: "DELETE" });
}

export async function toggleFavorite(id: string): Promise<{ isFavorite: boolean }> {
  return req<{ isFavorite: boolean }>(`/api/sessions/${id}/favorite`, {
    method: "PATCH",
  });
}

/* ---------------- 消息 ---------------- */

export async function getSessionMessages(id: string): Promise<SessionMessage[]> {
  return req<SessionMessage[]>(`/api/sessions/${id}/messages`);
}

export async function appendSessionMessage(
  id: string,
  msg: {
    role: "user" | "assistant";
    content: string;
    thinkingContent?: string;
    sources?: ChatSource[];
  },
): Promise<{ id: string }> {
  return req<{ id: string }>(`/api/sessions/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(msg),
  });
}
