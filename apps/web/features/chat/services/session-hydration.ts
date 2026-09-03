import type { ChatMessageStatus } from "@/types/ai-search";

export type ChatSessionPhase =
  | "LANDING"
  | "HYDRATING"
  | "READY"
  | "STREAMING"
  | "FAILED"
  | "STOPPED"
  | "STALE"
  | "RESETTING";

export interface SessionGenerationHandle {
  sessionId: string | null;
  token: number;
  controller: AbortController;
  isCurrent: () => boolean;
}

/**
 * Owns every asynchronous operation for the mounted Chat workspace.
 *
 * A generation is deliberately broader than hydration: a session load, a
 * create/resume request, its SSE stream, and stop confirmation all share the
 * same owner.  Invalidating the owner makes every late callback harmless.
 */
export class SessionGenerationGate {
  private sequence = 0;
  private active: SessionGenerationHandle | null = null;

  begin(sessionId: string | null): SessionGenerationHandle {
    this.cancel();
    const token = ++this.sequence;
    const controller = new AbortController();
    const handle: SessionGenerationHandle = {
      sessionId,
      token,
      controller,
      isCurrent: () => this.isCurrent(handle),
    };
    this.active = handle;
    return handle;
  }

  cancel(): void {
    this.sequence += 1;
    const active = this.active;
    this.active = null;
    // Clear ownership before aborting so an abort listener cannot observe the
    // retired generation as current.
    active?.controller.abort();
  }

  complete(handle: SessionGenerationHandle): boolean {
    if (!handle.isCurrent()) return false;
    this.sequence += 1;
    this.active = null;
    return true;
  }

  current(): SessionGenerationHandle | null {
    return this.active;
  }

  private isCurrent(handle: SessionGenerationHandle): boolean {
    return this.active === handle
      && handle.token === this.sequence
      && !handle.controller.signal.aborted;
  }
}

/** A restored stream is an interrupted answer that needs an explicit action. */
export function restoredTurnStatus(status: ChatMessageStatus | undefined): ChatMessageStatus {
  return status === "streaming" ? "stopped" : status ?? "stopped";
}

export function phaseForRestoredStatus(status: ChatMessageStatus | undefined): ChatSessionPhase {
  if (status === "failed") return "FAILED";
  if (status === "stopped" || status === "streaming") return "STOPPED";
  return "READY";
}
