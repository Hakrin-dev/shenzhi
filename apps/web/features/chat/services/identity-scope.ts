/** React workspace key for the authenticated Chat view, never a backend owner key. */
export function chatIdentityScope(userId: string | null | undefined): string {
  return userId ? `user:${userId}` : "anonymous";
}
