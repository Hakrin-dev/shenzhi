export const ASK_ROUTE = "/agents/ask";

const MAX_SESSION_ID_LENGTH = 200;

/**
 * Session IDs are opaque backend values. We only reject values that cannot be
 * a safe URL query value or are clearly unusable; the backend remains the
 * source of truth for whether an otherwise valid-looking ID exists.
 */
export function normalizeAskSessionId(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_SESSION_ID_LENGTH) return null;
  if ([...normalized].some((char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127;
  })) return null;
  return normalized;
}

export function askSessionUrl(sessionId: string | null): string {
  const normalized = sessionId?.trim();
  return normalized ? `${ASK_ROUTE}?session=${encodeURIComponent(normalized)}` : ASK_ROUTE;
}

/**
 * Read the canonical backend-session identity without touching SSR.
 *
 * The optional search string is the App Router snapshot used during SSR. On
 * the client, the live browser URL remains authoritative after replaceState.
 */
export function readCurrentSessionId(search?: string): string | null {
  const currentSearch = typeof window === "undefined" ? search ?? "" : window.location.search;
  const value = new URLSearchParams(currentSearch).get("session") ?? undefined;
  return normalizeAskSessionId(value);
}
