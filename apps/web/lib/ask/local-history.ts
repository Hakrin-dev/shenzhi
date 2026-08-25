"use client";

/** 本地历史条目中的单轮对话（与 use-ask-session AskTurn 结构兼容） */
export interface StoredAskTurn {
  localId: string;
  role: "user" | "assistant";
  question?: string;
  content: string;
  status: string;
  thought: string;
  references: unknown[];
  followups: string[];
  readCount?: number;
  durationMs?: number;
  messageId?: string;
  error?: string;
}

const STORAGE_KEY = "shenzhi.ask.local-sessions";
const MAX_SESSIONS = 30;

export interface LocalAskSession {
  id: string;
  title: string;
  updatedAt: number;
  turns: StoredAskTurn[];
  mode: string;
  model: string;
  web_search: boolean;
}

function readAll(): LocalAskSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalAskSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: LocalAskSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
}

export function listLocalAskSessions(): LocalAskSession[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getLocalAskSession(id: string): LocalAskSession | null {
  return readAll().find((s) => s.id === id) ?? null;
}

export function upsertLocalAskSession(session: LocalAskSession) {
  const rest = readAll().filter((s) => s.id !== session.id);
  writeAll([session, ...rest]);
}

export function deleteLocalAskSession(id: string) {
  writeAll(readAll().filter((s) => s.id !== id));
}

export function titleFromQuestion(question: string): string {
  const q = question.trim() || "问 AI";
  return q.length > 24 ? `${q.slice(0, 24)}…` : q;
}
