"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/clients/backend/http";
import { getChatSession, listChatSessions, resumeChatMessage, stopChatMessage, streamChatMessage } from "@/clients/backend/chat";
import { useAskSidebarBridge } from "@/stores/ask-sidebar-bridge";
import { beginTurn, restoreTurns } from "../services/conversation";
import { clearAskDraft } from "../services/draft";
import { messageForApiError } from "../services/errors";
import {
  deleteLocalAskSession,
  getLocalAskSession,
  listLocalAskSessions,
  titleFromQuestion,
  upsertLocalAskSession,
  type LocalAskSession,
} from "../services/local-history";
import type { ChatSendInput, ChatTurn } from "../types";
import type { ChatReplyMode, ChatModelId } from "@/types/ai-search";

const newTurn = (role: ChatTurn["role"], content = ""): ChatTurn => ({
  localId: crypto.randomUUID(), role, content, reasoning: "", thought: "正在连接生成服务…",
  status: role === "user" ? "done" : "streaming", references: [], followups: [], warnings: [],
});
const PHASES: Record<string, string> = {
  retrieving: "正在检索", web_search: "正在联网搜索", generating: "正在生成", followups: "正在生成追问",
};

export function useChatSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [localHistoryId, setLocalHistoryId] = useState<string | null>(null);
  const [dbSessions, setDbSessions] = useState<Awaited<ReturnType<typeof listChatSessions>>["sessions"]>([]);
  const [localHistory, setLocalHistory] = useState<LocalAskSession[]>([]);
  const sessionRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const revision = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const currentMessageId = useRef<string | null>(null);
  const lastInput = useRef<ChatSendInput | null>(null);
  const pendingCreate = useRef<{ request: ReturnType<typeof beginTurn>; localId: string } | null>(null);
  const turnsRef = useRef<ChatTurn[]>([]);
  const setSnapshot = useAskSidebarBridge((s) => s.setSnapshot);
  const pendingAction = useAskSidebarBridge((s) => s.pendingAction);
  const clearPending = useAskSidebarBridge((s) => s.clearPending);
  const bumpHistoryRefresh = useAskSidebarBridge((s) => s.bumpHistoryRefresh);

  const lock = useCallback((value: boolean) => { busyRef.current = value; setBusy(value); }, []);
  const patch = useCallback((id: string, data: Partial<ChatTurn>) => {
    setTurns((prev) => prev.map((turn) => turn.localId === id ? { ...turn, ...data } : turn));
  }, []);

  useEffect(() => { turnsRef.current = turns; }, [turns]);

  const refreshLocalHistory = useCallback(() => {
    setLocalHistory(listLocalAskSessions());
  }, []);

  const refreshDbSessions = useCallback(() => {
    void listChatSessions()
      .then((data) => setDbSessions(data.sessions))
      .catch(() => setDbSessions([]));
  }, []);

  useEffect(() => {
    refreshLocalHistory();
    refreshDbSessions();
  }, [refreshLocalHistory, refreshDbSessions, historyVersion]);

  /** 仅在后端未分配 session_id 时写入 localStorage，避免与 MemorySessionRepository 重复 */
  const persistLocalFallback = useCallback((input: ChatSendInput, nextTurns: ChatTurn[]) => {
    if (sessionRef.current) return;
    const id = localHistoryId ?? `local_${Date.now().toString(36)}`;
    if (!localHistoryId) setLocalHistoryId(id);
    const firstUser = nextTurns.find((t) => t.role === "user");
    upsertLocalAskSession({
      id,
      title: titleFromQuestion(firstUser?.content ?? input.question),
      updatedAt: Date.now(),
      turns: nextTurns,
      mode: input.mode,
      model: input.model,
      web_search: input.web_search,
    });
    refreshLocalHistory();
  }, [localHistoryId, refreshLocalHistory]);

  useEffect(() => () => {
    revision.current++;
    abortRef.current?.abort();
    if (currentMessageId.current) void stopChatMessage(currentMessageId.current).catch(() => {});
  }, []);

  const runStream = useCallback(async (messageId: string, localId: string, run: number,
    controller: AbortController, cursor?: string) => {
    currentMessageId.current = messageId;
    const active = () => run === revision.current && !controller.signal.aborted;
    try {
      await streamChatMessage(messageId, {
        onMeta: (meta) => {
          if (!active()) return;
          patch(localId, {
            ...(meta.phase ? { thought: PHASES[meta.phase] ?? meta.phase } : {}),
            ...(meta.read_count !== undefined ? { readCount: meta.read_count } : {}),
            ...(meta.warnings ? { warnings: meta.warnings } : {}),
          });
        },
        onDelta: (delta) => {
          if (!active()) return;
          setTurns((prev) => prev.map((turn) => turn.localId === localId ? {
            ...turn, content: turn.content + (delta.text ?? ""),
            reasoning: turn.reasoning + (delta.reasoning ?? ""),
          } : turn));
        },
        onRefs: ({ references }) => { if (active()) patch(localId, { references }); },
        onFollowups: ({ items }) => { if (active()) patch(localId, { followups: items }); },
        onDone: (done) => {
          if (!active()) return;
          patch(localId, { status: done.status, durationMs: done.duration_ms, thought: "生成结束" });
        },
        onError: (error) => { if (active()) patch(localId, { status: "failed", error: error.message }); },
      }, { signal: controller.signal, lastEventId: cursor });
    } catch (error) {
      if (active()) patch(localId, { status: "failed", error: messageForApiError(error) });
    }
  }, [patch]);

  const finish = useCallback((run: number) => {
    if (run !== revision.current) return;
    currentMessageId.current = null;
    lock(false);
    setHistoryVersion((value) => value + 1);
    refreshDbSessions();
    bumpHistoryRefresh();
  }, [lock, refreshDbSessions, bumpHistoryRefresh]);

  const send = useCallback(async (input: ChatSendInput) => {
    const question = input.question.trim();
    if (!question || busyRef.current) return;
    lock(true);
    const run = ++revision.current;
    const controller = new AbortController();
    abortRef.current = controller;
    lastInput.current = { ...input, question };
    const retiringLocalId = localHistoryId;
    setLocalHistoryId(null);
    const assistant = newTurn("assistant");
    setTurns((prev) => [...prev, newTurn("user", question), assistant]);
    try {
      const request = beginTurn(sessionRef.current, { ...input, question });
      pendingCreate.current = { request, localId: assistant.localId };
      const created = await request;
      if (pendingCreate.current?.request === request) pendingCreate.current = null;
      if (controller.signal.aborted || run !== revision.current) {
        await stopChatMessage(created.message_id);
        return;
      }
      sessionRef.current = created.session_id;
      setSessionId(created.session_id);
      if (retiringLocalId) deleteLocalAskSession(retiringLocalId);
      patch(assistant.localId, { messageId: created.message_id });
      clearAskDraft();
      await runStream(created.message_id, assistant.localId, run, controller);
    } catch (error) {
      if (run === revision.current) {
        patch(assistant.localId, { status: "failed", error: messageForApiError(error) });
        if (!sessionRef.current) persistLocalFallback(input, turnsRef.current);
      }
    } finally {
      if (run === revision.current) pendingCreate.current = null;
      finish(run);
    }
  }, [finish, localHistoryId, lock, patch, persistLocalFallback, runStream]);

  const stop = useCallback(async () => {
    const run = ++revision.current;
    abortRef.current?.abort();
    let messageId = currentMessageId.current;
    const pending = pendingCreate.current;
    currentMessageId.current = null;
    lock(true);
    setTurns((prev) => prev.map((turn) => turn.status === "streaming" ? { ...turn, status: "stopped", thought: "已停止" } : turn));
    try {
      if (pending) {
        const created = await pending.request;
        messageId = created.message_id;
        if (run === revision.current) {
          sessionRef.current = created.session_id;
          setSessionId(created.session_id);
          patch(pending.localId, { messageId, status: "stopped" });
          pendingCreate.current = null;
        }
      }
      if (messageId) await stopChatMessage(messageId);
      if (lastInput.current && !sessionRef.current) {
        persistLocalFallback(lastInput.current, turnsRef.current);
      }
    }
    catch (error) {
      if (run === revision.current) setTurns((prev) => prev.map((turn) => turn.messageId === messageId
        ? { ...turn, error: `停止请求未确认：${messageForApiError(error)}` } : turn));
    } finally { finish(run); }
  }, [finish, lock, patch, persistLocalFallback]);

  const resumeLast = useCallback(async () => {
    if (busyRef.current) return;
    const last = turns.at(-1);
    if (!last || !["stopped", "failed"].includes(last.status)) return;
    if (!last.messageId) {
      if (lastInput.current) {
        setTurns((prev) => prev.slice(0, -2));
        await send(lastInput.current);
      }
      return;
    }
    lock(true);
    const run = ++revision.current;
    const controller = new AbortController();
    abortRef.current = controller;
    patch(last.localId, { status: "streaming", error: undefined, thought: "继续生成…" });
    let resend: ChatSendInput | null = null;
    try {
      const resumed = await resumeChatMessage(last.messageId);
      if (run !== revision.current || controller.signal.aborted) {
        await stopChatMessage(resumed.message_id);
        return;
      }
      await runStream(resumed.message_id, last.localId, run, controller, resumed.last_event_id);
    } catch (error) {
      if (run === revision.current) {
        // Server message gone (DB cleared / owner changed) — fall back to a fresh send.
        if (error instanceof ApiError && error.status === 404 && lastInput.current) {
          patch(last.localId, {
            status: "failed",
            messageId: undefined,
            error: "原回答已失效，正在重新发送…",
          });
          setTurns((prev) => prev.slice(0, -2));
          resend = lastInput.current;
        } else {
          patch(last.localId, { status: "failed", error: messageForApiError(error) });
        }
      }
    } finally { finish(run); }
    if (resend) await send(resend);
  }, [finish, lock, patch, runStream, send, turns]);

  const abortCurrent = useCallback(() => {
    revision.current++;
    abortRef.current?.abort();
    currentMessageId.current = null;
    pendingCreate.current = null;
    lock(false);
  }, [lock]);

  const reset = useCallback(() => {
    abortCurrent();
    sessionRef.current = null;
    setSessionId(null);
    setLocalHistoryId(null);
    setTurns([]);
    lastInput.current = null;
  }, [abortCurrent]);

  const openSession = useCallback(async (id: string) => {
    abortCurrent();
    const run = ++revision.current;
    lock(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const session = await getChatSession(id);
      if (run !== revision.current) return undefined;
      sessionRef.current = id;
      setSessionId(id);
      setLocalHistoryId(null);
      const restored = restoreTurns(session);
      setTurns(restored);
      const latest = session.messages.at(-1);
      if (latest?.status === "streaming") {
        void runStream(latest.id, latest.id, run, controller, latest.last_event_id).finally(() => finish(run));
      } else finish(run);
      return session;
    } catch (error) { finish(run); throw error; }
  }, [abortCurrent, finish, lock, runStream]);

  const loadLocalSession = useCallback((item: LocalAskSession) => {
    abortCurrent();
    sessionRef.current = null;
    setSessionId(null);
    setLocalHistoryId(item.id);
    setTurns(item.turns);
    lastInput.current = {
      question: item.turns.find((t) => t.role === "user")?.content ?? "",
      mode: item.mode as ChatReplyMode,
      model: item.model as ChatModelId,
      web_search: item.web_search,
      attachments: [],
    };
  }, [abortCurrent]);

  const loadHistoryItem = useCallback((item: { id: string; source: "db" | "local" }) => {
    if (item.source === "db") {
      void openSession(item.id);
      return;
    }
    const local = getLocalAskSession(item.id);
    if (local) loadLocalSession(local);
  }, [loadLocalSession, openSession]);

  const activeHistoryId = sessionId ?? localHistoryId;

  useEffect(() => {
    const items = [
      ...dbSessions.map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updated_at,
        source: "db" as const,
        favorite: s.favorite,
      })),
      ...localHistory.map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        source: "local" as const,
      })),
    ].sort((a, b) => b.updatedAt - a.updatedAt);
    setSnapshot(items, activeHistoryId);
  }, [dbSessions, localHistory, activeHistoryId, setSnapshot]);

  useEffect(() => {
    if (!pendingAction) return;
    if (pendingAction.type === "new") {
      reset();
    } else {
      loadHistoryItem(pendingAction.item);
    }
    clearPending();
  }, [pendingAction, reset, loadHistoryItem, clearPending]);

  return { sessionId, turns, busy, historyVersion, send, stop, resumeLast, reset, openSession, activeHistoryId };
}
