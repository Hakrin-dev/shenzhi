"use client";

import { useCallback, useRef, useState } from "react";
import {
  createChatSession,
  resumeChatMessage,
  sendChatMessage,
  stopChatMessage,
  streamChatMessage,
} from "@/lib/api/search";
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

export interface AskTurn {
  localId: string;
  role: "user" | "assistant";
  question?: string;
  content: string;
  status: ChatMessageStatus;
  thought: string;
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
  const abortRef = useRef<AbortController | null>(null);
  const currentMessageId = useRef<string | null>(null);
  const lastEventId = useRef<string | undefined>(undefined);

  const patchAssistant = useCallback(
    (localId: string, patch: Partial<AskTurn>) => {
      setTurns((prev) =>
        prev.map((t) => (t.localId === localId ? { ...t, ...patch } : t)),
      );
    },
    [],
  );

  const runStream = useCallback(
    async (messageId: string, assistantLocalId: string, signal?: AbortSignal) => {
      currentMessageId.current = messageId;
      lastEventId.current = undefined;

      try {
        await streamChatMessage(
          messageId,
          {
            onMeta: (meta) => {
              const bits = [
                meta.phase === "generating" ? "正在生成" : "正在检索",
                typeof meta.read_count === "number"
                  ? `已阅读 ${meta.read_count} 篇`
                  : "",
                meta.context_truncated ? "上下文已截断" : "",
              ].filter(Boolean);
              patchAssistant(assistantLocalId, {
                thought: bits.join(" · ") || "思考中",
                readCount: meta.read_count,
              });
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
              patchAssistant(assistantLocalId, {
                status: done.status || "done",
                durationMs: done.duration_ms,
                thought: "思考完成",
              });
            },
            onError: (err) => {
              patchAssistant(assistantLocalId, {
                status: "failed",
                error: err.message || messageForApiError(new ApiError(err.code, err.message)),
              });
            },
          },
          { signal, lastEventId: lastEventId.current },
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
    [patchAssistant],
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
        await runStream(created.message_id, assistantTurn.localId, runSignal);
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
    [busy, patchAssistant, runStream, sessionId],
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
      await runStream(resumed.message_id, failed.localId);
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
  }, []);

  return { sessionId, turns, busy, send, stop, resumeLast, reset };
}
