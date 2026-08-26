"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AI_BACKEND_MODE,
  createChatSession,
  resumeChatMessage,
  sendChatMessage,
  stopChatMessage,
  streamChatMessage,
  type StreamModeBPayload,
} from "@/lib/api/search";
import {
  fetchWebSearchSources,
  webSourcesToReferences,
} from "@/lib/api/web-search";
import {
  getLocalAskSession,
  listLocalAskSessions,
  titleFromQuestion,
  upsertLocalAskSession,
  type LocalAskSession,
} from "@/lib/ask/local-history";
import {
  appendSessionMessage,
  createSession,
  getSessionMessages,
  listSessions,
  type SessionListItem,
} from "@b/lib/api/sessions";
import { toBAttachment } from "@b/lib/ask/draft";
import { buildModelMessages } from "@b/lib/chat-prompt";
import type { ChatMessage, ChatSource } from "@b/types";
import { messageForApiError } from "@/lib/ask/errors";
import { ApiError } from "@/lib/api/http";
import type {
  ChatAttachment,
  ChatMessageStatus,
  ChatModelId,
  ChatReference,
  ChatReplyMode,
  CreateChatSessionRequest,
} from "@/types/ai-search";
import { useAskSidebarBridge } from "@/stores/ask-sidebar-bridge";

function mapToBStyle(
  mode: ChatReplyMode,
): "fast" | "deep" | "inspire" | "question" {
  if (mode === "idea") return "inspire";
  if (mode === "doubt") return "question";
  return mode;
}

export interface AskTurn {
  localId: string;
  role: "user" | "assistant";
  question?: string;
  content: string;
  status: ChatMessageStatus;
  thought: string;
  /** R1 / reasoning 模型完整思考链（SSE thinking_delta 累加） */
  thinkingContent?: string;
  references: ChatReference[];
  followups: string[];
  readCount?: number;
  durationMs?: number;
  messageId?: string;
  error?: string;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function turnsToHistory(turns: AskTurn[]): ChatMessage[] {
  return turns
    .filter(
      (t) =>
        t.role === "user" ||
        (t.role === "assistant" &&
          t.content &&
          t.status !== "streaming" &&
          t.status !== "failed"),
    )
    .map((t) => ({
      role: t.role,
      content: t.role === "user" ? (t.question ?? t.content) : t.content,
    }));
}

function buildModeBPayload(
  request: CreateChatSessionRequest,
  historyTurns: AskTurn[],
  webSearchSources: ChatSource[] = [],
): StreamModeBPayload {
  const { messages } = buildModelMessages({
    style: mapToBStyle(request.mode),
    history: turnsToHistory(historyTurns),
    attachments: toBAttachment(request.attachments),
    webSearchSources,
    webSearchEnabled: request.web_search,
  });
  return { request, messages, webSearchSources };
}

export interface AskHistoryItem {
  id: string;
  title: string;
  updatedAt: number;
  source: "db" | "local";
}

function sessionMessagesToTurns(
  msgs: Awaited<ReturnType<typeof getSessionMessages>>,
): AskTurn[] {
  return msgs.map((m) =>
    m.role === "user"
      ? {
          localId: m.id,
          role: "user" as const,
          question: m.content,
          content: m.content,
          status: "done" as const,
          thought: "",
          references: [],
          followups: [],
        }
      : {
          localId: m.id,
          role: "assistant" as const,
          content: m.content,
          status: "done" as const,
          thought: "思考完成",
          thinkingContent: m.thinkingContent ?? undefined,
          references: [],
          followups: [],
        },
  );
}

export interface AskSendInput {
  question: string;
  mode: ChatReplyMode;
  model: ChatModelId;
  web_search: boolean;
  attachments: ChatAttachment[];
}

export function useAskSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [localHistoryId, setLocalHistoryId] = useState<string | null>(null);
  const [localHistory, setLocalHistory] = useState<LocalAskSession[]>([]);
  const [dbSessions, setDbSessions] = useState<SessionListItem[]>([]);
  const [dbHistoryId, setDbHistoryId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const currentMessageId = useRef<string | null>(null);
  const lastEventId = useRef<string | undefined>(undefined);
  const dbSessionIdRef = useRef<string | null>(null);
  const lastInputRef = useRef<AskSendInput | null>(null);
  const turnsRef = useRef<AskTurn[]>([]);
  const setSnapshot = useAskSidebarBridge((s) => s.setSnapshot);
  const pendingAction = useAskSidebarBridge((s) => s.pendingAction);
  const clearPending = useAskSidebarBridge((s) => s.clearPending);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const refreshLocalHistory = useCallback(() => {
    setLocalHistory(listLocalAskSessions());
  }, []);

  const refreshDbSessions = useCallback(() => {
    listSessions()
      .then(setDbSessions)
      .catch(() => setDbSessions([]));
  }, []);

  useEffect(() => {
    refreshLocalHistory();
    refreshDbSessions();
  }, [refreshLocalHistory, refreshDbSessions]);

  const persistLocal = useCallback(
    (input: AskSendInput, nextTurns: AskTurn[]) => {
      const id = localHistoryId ?? `local_${Date.now().toString(36)}`;
      if (!localHistoryId) setLocalHistoryId(id);
      const firstUser = nextTurns.find((t) => t.role === "user");
      upsertLocalAskSession({
        id,
        title: titleFromQuestion(firstUser?.question ?? firstUser?.content ?? "问 AI"),
        updatedAt: Date.now(),
        turns: nextTurns as LocalAskSession["turns"],
        mode: input.mode,
        model: input.model,
        web_search: input.web_search,
      });
      refreshLocalHistory();
    },
    [localHistoryId, refreshLocalHistory],
  );

  const ensureDbSession = useCallback(async (title: string, input: AskSendInput) => {
    if (dbSessionIdRef.current) return dbSessionIdRef.current;
    try {
      const { id } = await createSession({
        title: title.slice(0, 30),
        model: input.model,
        style: mapToBStyle(input.mode),
        webSearch: input.web_search,
        attachments: input.attachments as never[],
      });
      dbSessionIdRef.current = id;
      setDbHistoryId(id);
      refreshDbSessions();
      return id;
    } catch {
      return null;
    }
  }, [refreshDbSessions]);

  const patchAssistant = useCallback(
    (localId: string, patch: Partial<AskTurn>) => {
      setTurns((prev) =>
        prev.map((t) => (t.localId === localId ? { ...t, ...patch } : t)),
      );
    },
    [],
  );

  const lastSendRef = useRef<{
    request: CreateChatSessionRequest;
    historyTurns: AskTurn[];
  } | null>(null);

  const runStream = useCallback(
    async (
      messageId: string,
      assistantLocalId: string,
      signal?: AbortSignal,
      streamCtx?: { request: CreateChatSessionRequest; historyTurns: AskTurn[] },
    ) => {
      currentMessageId.current = messageId;
      lastEventId.current = undefined;

      try {
        const streamOptions: {
          signal?: AbortSignal;
          lastEventId?: string;
          modeBPayload?: StreamModeBPayload;
        } = { signal, lastEventId: lastEventId.current };

        if (AI_BACKEND_MODE === "B" && streamCtx) {
          let webSearchSources: ChatSource[] = [];
          if (streamCtx.request.web_search) {
            patchAssistant(assistantLocalId, { thought: "正在联网检索…" });
            webSearchSources = await fetchWebSearchSources(
              streamCtx.request.question,
              signal,
            );
            if (signal?.aborted) return;
            if (webSearchSources.length > 0) {
              patchAssistant(assistantLocalId, {
                thought: `已阅读 ${webSearchSources.length} 篇 · 正在生成`,
                references: webSourcesToReferences(webSearchSources),
              });
            } else {
              patchAssistant(assistantLocalId, {
                thought: "联网搜索无结果 · 正在生成",
              });
            }
          }
          streamOptions.modeBPayload = buildModeBPayload(
            streamCtx.request,
            streamCtx.historyTurns,
            webSearchSources,
          );
        }

        await streamChatMessage(
          messageId,
          {
            onMeta: (meta) => {
              const patch: Partial<AskTurn> = {};
              const td = (meta as { thinking_delta?: string }).thinking_delta;
              if (typeof td === "string" && td) {
                setTurns((prev) =>
                  prev.map((t) =>
                    t.localId === assistantLocalId
                      ? {
                          ...t,
                          thinkingContent: (t.thinkingContent ?? "") + td,
                        }
                      : t,
                  ),
                );
              }
              const bits = [
                meta.phase === "generating" ? "正在生成" : "正在检索",
                typeof meta.read_count === "number"
                  ? `已阅读 ${meta.read_count} 篇`
                  : "",
                meta.context_truncated ? "上下文已截断" : "",
              ].filter(Boolean);
              patch.thought = bits.join(" · ") || "思考中";
              patch.readCount = meta.read_count;
              patchAssistant(assistantLocalId, patch);
            },
            onDelta: (delta) => {
              setTurns((prev) =>
                prev.map((t) =>
                  t.localId === assistantLocalId
                    ? { ...t, content: t.content + (delta.text ?? "") }
                    : t,
                ),
              );
            },
            onRefs: (refs) => {
              patchAssistant(assistantLocalId, {
                references: refs.references,
              });
            },
            onFollowups: (followups) => {
              patchAssistant(assistantLocalId, { followups: followups.items });
            },
            onDone: (done) => {
              const st = done.status || "done";
              const tc =
                (done as { thinkingContent?: string }).thinkingContent ??
                undefined;
              patchAssistant(assistantLocalId, {
                status: st,
                durationMs: done.duration_ms,
                thought: "思考完成",
                ...(tc ? { thinkingContent: tc } : {}),
              });
              const input = lastInputRef.current;
              const assistant = turnsRef.current.find(
                (t) => t.localId === assistantLocalId,
              );
              if (input) {
                const nextTurns = turnsRef.current.map((t) =>
                  t.localId === assistantLocalId
                    ? {
                        ...t,
                        status: st,
                        durationMs: done.duration_ms,
                        thought: "思考完成",
                        ...(tc ? { thinkingContent: tc } : {}),
                      }
                    : t,
                );
                persistLocal(input, nextTurns);
              }
              const dbId = dbSessionIdRef.current;
              if (dbId && st !== "failed" && assistant?.content) {
                appendSessionMessage(dbId, {
                  role: "assistant",
                  content: assistant.content,
                  thinkingContent:
                    tc ?? assistant.thinkingContent ?? undefined,
                })
                  .then(() => refreshDbSessions())
                  .catch(() => {});
              }
            },
            onError: (err) => {
              patchAssistant(assistantLocalId, {
                status: "failed",
                error: err.message || messageForApiError(new ApiError(err.code, err.message)),
              });
            },
          },
          streamOptions,
        );
      } catch (error) {
        if (signal?.aborted) return;
        patchAssistant(assistantLocalId, {
          status: "failed",
          error: messageForApiError(error),
        });
      } finally {
        setBusy(false);
        currentMessageId.current = null;
      }
    },
    [patchAssistant, persistLocal, refreshDbSessions],
  );

  const send = useCallback(
    async (input: AskSendInput, signal?: AbortSignal) => {
      const question = input.question.trim();
      if (!question || busy) return;
      if (signal?.aborted) return;

      const controller = new AbortController();
      abortRef.current = controller;
      if (signal) {
        signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
      const runSignal = controller.signal;

      const userTurn: AskTurn = {
        localId: uid(),
        role: "user",
        question,
        content: question,
        status: "done",
        thought: "",
        references: [],
        followups: [],
      };
      const assistantTurn: AskTurn = {
        localId: uid(),
        role: "assistant",
        content: "",
        status: "streaming",
        thought: "正在请求生成服务…",
        references: [],
        followups: [],
      };

      const isFollowup = Boolean(sessionId);
      if (isFollowup) {
        setTurns((prev) => [...prev, userTurn, assistantTurn]);
      }
      setBusy(true);

      const request: CreateChatSessionRequest = {
        type: "chat",
        question,
        mode: input.mode,
        model: input.model,
        web_search: input.web_search,
        attachments: input.attachments,
      };

      const historyTurns = isFollowup ? turns : [];
      lastSendRef.current = { request, historyTurns };
      lastInputRef.current = input;

      void ensureDbSession(question.slice(0, 30), input).then((dbId) => {
        if (dbId) {
          appendSessionMessage(dbId, { role: "user", content: question }).catch(
            () => {},
          );
        }
      });

      try {
        const created = sessionId
          ? await sendChatMessage(
              sessionId,
              {
                question,
                mode: input.mode,
                model: input.model,
                web_search: input.web_search,
                attachments: input.attachments,
              },
              { signal: runSignal },
            )
          : await createChatSession(request, { signal: runSignal });

        if (runSignal.aborted) {
          setBusy(false);
          return;
        }

        setSessionId(created.session_id);
        if (!isFollowup) {
          setTurns((prev) => [
            ...prev,
            userTurn,
            { ...assistantTurn, messageId: created.message_id },
          ]);
        } else {
          patchAssistant(assistantTurn.localId, {
            messageId: created.message_id,
          });
        }
        await runStream(created.message_id, assistantTurn.localId, runSignal, {
          request,
          historyTurns,
        });
      } catch (error) {
        if (runSignal.aborted) {
          setBusy(false);
          return;
        }
        if (!isFollowup) {
          setTurns((prev) => [
            ...prev,
            userTurn,
            {
              ...assistantTurn,
              status: "failed",
              error: messageForApiError(error),
            },
          ]);
        } else {
          patchAssistant(assistantTurn.localId, {
            status: "failed",
            error: messageForApiError(error),
          });
        }
        setBusy(false);
      }
    },
    [busy, ensureDbSession, patchAssistant, runStream, sessionId, persistLocal],
  );

  const stop = useCallback(async () => {
    const messageId = currentMessageId.current;
    abortRef.current?.abort();
    if (messageId) {
      try {
        await stopChatMessage(messageId);
      } catch {
        /* 本地已中断 */
      }
    }
    setTurns((prev) =>
      prev.map((t) =>
        t.status === "streaming" ? { ...t, status: "stopped", thought: "已停止" } : t,
      ),
    );
    setBusy(false);
  }, []);

  const resumeLast = useCallback(async () => {
    const failed = [...turns].reverse().find((t) => t.role === "assistant" && t.messageId);
    if (!failed?.messageId || busy) return;
    setBusy(true);
    patchAssistant(failed.localId, {
      status: "streaming",
      error: undefined,
      thought: "继续生成…",
    });
    try {
      const resumed = await resumeChatMessage(failed.messageId);
      patchAssistant(failed.localId, { messageId: resumed.message_id });
      const ctx = lastSendRef.current;
      await runStream(
        resumed.message_id,
        failed.localId,
        undefined,
        ctx ?? undefined,
      );
    } catch (error) {
      patchAssistant(failed.localId, {
        status: "failed",
        error: messageForApiError(error),
      });
      setBusy(false);
    }
  }, [busy, patchAssistant, runStream, turns]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSessionId(null);
    setTurns([]);
    setBusy(false);
    setLocalHistoryId(null);
    setDbHistoryId(null);
    dbSessionIdRef.current = null;
  }, []);

  const loadLocalSession = useCallback((item: LocalAskSession) => {
    abortRef.current?.abort();
    setLocalHistoryId(item.id);
    setDbHistoryId(null);
    dbSessionIdRef.current = null;
    setSessionId(null);
    setTurns(item.turns as AskTurn[]);
    setBusy(false);
  }, []);

  const loadDbSession = useCallback(async (id: string) => {
    abortRef.current?.abort();
    try {
      const msgs = await getSessionMessages(id);
      setDbHistoryId(id);
      setLocalHistoryId(null);
      dbSessionIdRef.current = id;
      setSessionId(null);
      setTurns(sessionMessagesToTurns(msgs));
      setBusy(false);
    } catch {
      /* 加载失败保持当前视图 */
    }
  }, []);

  const loadHistoryItem = useCallback(
    (item: AskHistoryItem) => {
      if (item.source === "db") {
        void loadDbSession(item.id);
        return;
      }
      const local = getLocalAskSession(item.id);
      if (local) loadLocalSession(local);
    },
    [loadDbSession, loadLocalSession],
  );

  const activeHistoryId = dbHistoryId ?? localHistoryId;

  useEffect(() => {
    const items: AskHistoryItem[] = [
      ...dbSessions.map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: new Date(s.updatedAt).getTime(),
        source: "db" as const,
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

  const historyItems: AskHistoryItem[] = [
    ...dbSessions.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: new Date(s.updatedAt).getTime(),
      source: "db" as const,
    })),
    ...localHistory.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt,
      source: "local" as const,
    })),
  ].sort((a, b) => b.updatedAt - a.updatedAt);

  return {
    sessionId,
    turns,
    busy,
    send,
    stop,
    resumeLast,
    reset,
    historyItems,
    activeHistoryId,
    loadLocalSession,
    loadDbSession,
    loadHistoryItem,
    refreshLocalHistory,
    refreshDbSessions,
  };
}
