import {
  optionalEnv,
  parseCommaSeparatedEnv,
} from "./env";

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

export function getAuthEmailVerificationSettings() {
  return {
    // Registration verifies the mailbox before Better Auth creates the user,
    // so sign-up must not send a second verification message.
    sendOnSignUp: false,
    sendVerificationOnSignUp: false,
    overrideDefaultEmailVerification: true,
    autoSignInAfterVerification: false,
    // Keep password sign-in closed to any historical unverified accounts.
    // Newly registered users are marked verified by the registration plugin.
    requireEmailVerification: true,
  };
}
