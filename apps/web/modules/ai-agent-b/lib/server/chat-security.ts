/**
 * B 模块 API 安全：鉴权响应、历史净化、服务端重建 messages、配额校验。
 */
import { NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@b/lib/auth-bridge";
import { buildModelMessages } from "@b/lib/chat-prompt";
import type { AttachmentAggregationWarning } from "@b/lib/chat-prompt";
import { db } from "@b/lib/db";
import type {
  ChatAttachment,
  ChatMessage,
  ChatRequest,
  ChatSource,
  ChatStyle,
} from "@b/types";

const MAX_HISTORY_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 32_000;
const MAX_ATTACHMENTS = 5;
const DEFAULT_DAILY_LIMIT = 20;
const DEFAULT_DEEP_DAILY_LIMIT = 5;
const DEEP_STYLES = new Set<ChatStyle>(["deep", "inspire", "question"]);

export function jsonUnauthorized(message = "未登录") {
  return NextResponse.json(
    { code: 401, message, data: undefined },
    { status: 401 },
  );
}

export async function requireApiUser() {
  return getCurrentUserOrThrow();
}

/** 剥离客户端伪造的 system，只保留 user/assistant 历史 */
export function sanitizeChatHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: String(m.content ?? "").slice(0, MAX_MESSAGE_CHARS),
      ...(m.reasoning_content
        ? {
            reasoning_content: String(m.reasoning_content).slice(
              0,
              MAX_MESSAGE_CHARS,
            ),
          }
        : {}),
    }));
}

function sanitizeAttachments(raw: ChatAttachment[]): ChatAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_ATTACHMENTS).map((a, idx) => ({
    id: String(a.id ?? `att_${idx}`).slice(0, 64),
    name: String(a.name ?? `附件 ${idx + 1}`).slice(0, 255),
    type: a.type ?? "other",
    size: typeof a.size === "number" ? a.size : undefined,
    text:
      typeof a.text === "string" ? a.text.slice(0, 32_000) : undefined,
    error:
      typeof a.error === "string" ? a.error.slice(0, 500) : undefined,
  }));
}

function sanitizeWebSources(raw: ChatSource[] | undefined): ChatSource[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 10).map((s, idx) => ({
    id: typeof s.id === "number" ? s.id : idx + 1,
    title: String(s.title ?? "").slice(0, 500),
    url: s.url ? String(s.url).slice(0, 2000) : undefined,
    venue: s.venue ? String(s.venue).slice(0, 200) : undefined,
    snippet: s.snippet ? String(s.snippet).slice(0, 500) : undefined,
    author: s.author ? String(s.author).slice(0, 200) : undefined,
    type: s.type,
  }));
}

/** 服务端权威重建 LLM messages（不信任客户端 system） */
export function rebuildTrustedModelMessages(body: ChatRequest): {
  messages: ChatMessage[];
  attachmentWarnings: AttachmentAggregationWarning[];
} {
  const attachments = sanitizeAttachments(body.attachments ?? []);
  const webSearchSources = sanitizeWebSources(body.webSearchSources);
  let history = sanitizeChatHistory(body.messages ?? []);

  const userText = String(body.message ?? "").trim().slice(0, MAX_MESSAGE_CHARS);
  if (userText) {
    const last = history[history.length - 1];
    if (!last || last.role !== "user" || last.content !== userText) {
      history = [...history, { role: "user", content: userText }];
    }
  }

  return buildModelMessages({
    style: body.style,
    history,
    attachments,
    webSearchSources,
    webSearchEnabled: Boolean(body.webSearch),
  });
}

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function assertChatQuota(userId: string, style: ChatStyle) {
  const dailyLimit = Number(process.env.AI_DAILY_QUOTA ?? DEFAULT_DAILY_LIMIT);
  const deepLimit = Number(
    process.env.AI_DEEP_DAILY_QUOTA ?? DEFAULT_DEEP_DAILY_LIMIT,
  );
  const since = startOfUtcDay();

  const totalToday = await db.chatMessage.count({
    where: {
      role: "user",
      createdAt: { gte: since },
      session: { userId, deletedAt: null },
    },
  });

  if (totalToday >= dailyLimit) {
    const err = new Error(`今日对话次数已达上限（${dailyLimit} 次）`);
    (err as Error & { status?: number; code?: string }).status = 429;
    (err as Error & { code?: string }).code = "QUOTA_EXCEEDED";
    throw err;
  }

  if (DEEP_STYLES.has(style)) {
    const deepToday = await db.chatMessage.count({
      where: {
        role: "user",
        createdAt: { gte: since },
        session: { userId, deletedAt: null, style: { in: [...DEEP_STYLES] } },
      },
    });
    if (deepToday >= deepLimit) {
      const err = new Error(
        `今日深度/灵感/质疑模式次数已达上限（${deepLimit} 次）`,
      );
      (err as Error & { status?: number; code?: string }).status = 429;
      (err as Error & { code?: string }).code = "DEEP_QUOTA_EXCEEDED";
      throw err;
    }
  }
}

export function quotaErrorResponse(err: unknown) {
  const status = (err as { status?: number })?.status ?? 429;
  const code = (err as { code?: string })?.code ?? "QUOTA_EXCEEDED";
  return NextResponse.json(
    {
      code: status,
      message: (err as Error)?.message ?? "配额已用尽",
      data: { error_code: code },
    },
    { status },
  );
}

/** 供 /search/config 展示真实配额（基于 DB 当日 user 消息数） */
export async function getQuotaSnapshot(userId: string) {
  const dailyLimit = Number(process.env.AI_DAILY_QUOTA ?? DEFAULT_DAILY_LIMIT);
  const deepLimit = Number(
    process.env.AI_DEEP_DAILY_QUOTA ?? DEFAULT_DEEP_DAILY_LIMIT,
  );
  const since = startOfUtcDay();

  const used = await db.chatMessage.count({
    where: {
      role: "user",
      createdAt: { gte: since },
      session: { userId, deletedAt: null },
    },
  });

  const deep_used = await db.chatMessage.count({
    where: {
      role: "user",
      createdAt: { gte: since },
      session: { userId, deletedAt: null, style: { in: [...DEEP_STYLES] } },
    },
  });

  return {
    used,
    limit: dailyLimit,
    deep_used,
    deep_limit: deepLimit,
  };
}
