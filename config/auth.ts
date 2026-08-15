import { optionalEnv, parseCommaSeparatedEnv } from "./env";

const secret = optionalEnv("BETTER_AUTH_SECRET");
const baseURL = optionalEnv("BETTER_AUTH_URL");
const trustedOrigins = parseCommaSeparatedEnv("BETTER_AUTH_TRUSTED_ORIGINS");

/**
 * Server-side Better Auth environment configuration.
 *
 * Keep optional values omitted when they are not configured so Better Auth
 * retains its existing defaults and environment-based behavior.
 */
export const authConfig = {
  ...(secret ? { secret } : {}),
  ...(baseURL ? { baseURL } : {}),
  ...(trustedOrigins.length > 0 ? { trustedOrigins } : {}),
};
