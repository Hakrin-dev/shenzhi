type AuthSession = {
  user?: {
    id?: string | null;
    email?: string | null;
  } | null;
} | null;

export type SessionResolver = (headers: Headers) => Promise<AuthSession>;

async function getBetterAuthSession(headers: Headers): Promise<AuthSession> {
  // Keep this lazy so the transport helper does not initialize Better Auth at module load.
  const authModulePath = "../../lib/auth/server";
  const { auth } = await import(authModulePath);
  return auth.api.getSession({ headers });
}

/** A missing session is anonymous; resolver failures must remain authentication failures. */
export async function attachIdentity(
  requestHeaders: Headers,
  backendHeaders: Headers,
  resolveSession: SessionResolver = getBetterAuthSession,
) {
  const session = await resolveSession(requestHeaders);
  const user = session?.user;
  if (!user?.id) return "anonymous" as const;
  backendHeaders.set("X-ShenZhi-User-Id", user.id);
  if (user.email) backendHeaders.set("X-ShenZhi-User-Email", user.email);
  return "authenticated" as const;
}
