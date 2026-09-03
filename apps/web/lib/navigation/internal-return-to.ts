/**
 * Accept only a same-origin, internal relative navigation target.
 *
 * This intentionally does not normalize or decode the value beyond URL's
 * relative-path check: callers may safely preserve opaque query parameters.
 */
export function normalizeInternalReturnTo(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value.trim() !== value || /[\s\\\u0000-\u001f\u007f]/.test(value)) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const parsed = new URL(value, "https://shenzhi-internal.invalid");
    if (parsed.origin !== "https://shenzhi-internal.invalid") return null;
    return value;
  } catch {
    return null;
  }
}

export function appendInternalReturnTo(path: string, returnTo: unknown): string {
  const safe = normalizeInternalReturnTo(returnTo);
  if (!safe) return path;
  return `${path}${path.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(safe)}`;
}
