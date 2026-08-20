import {
  optionalEnv,
  parseBooleanEnv,
  parseCommaSeparatedEnv,
} from "./env";

const secret = optionalEnv("BETTER_AUTH_SECRET");
const baseURL = optionalEnv("BETTER_AUTH_URL");
const trustedOrigins = parseCommaSeparatedEnv("BETTER_AUTH_TRUSTED_ORIGINS");
const requireEmailVerification = parseBooleanEnv(
  "AUTH_REQUIRE_EMAIL_VERIFICATION",
);

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
  requireEmailVerification,
};

export function getAuthEmailVerificationSettings(
  required = authConfig.requireEmailVerification,
) {
  return {
    // The Email OTP plugin overrides Better Auth's default link email, so the
    // core sign-up flow emits an OTP only after a real user is created. Its
    // synthetic duplicate response remains indistinguishable and sends none.
    sendOnSignUp: required,
    sendVerificationOnSignUp: false,
    overrideDefaultEmailVerification: true,
    autoSignInAfterVerification: required,
    requireEmailVerification: required,
  };
}
