import {
  optionalEnv,
  parseBooleanEnv,
  parseCommaSeparatedEnv,
} from "./env";

const enabled = parseBooleanEnv("TURNSTILE_ENABLED");
const secretKey = optionalEnv("TURNSTILE_SECRET_KEY");
const expectedAction = optionalEnv("TURNSTILE_EXPECTED_ACTION");
const allowedHostnames = parseCommaSeparatedEnv(
  "TURNSTILE_ALLOWED_HOSTNAMES",
);

/**
 * Server-side Cloudflare Turnstile configuration.
 *
 * The secret key never reaches the browser; the public site key is consumed
 * by Client Components directly through `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
 */
export const turnstileConfig = {
  enabled,
  ...(secretKey ? { secretKey } : {}),
  ...(expectedAction ? { expectedAction } : {}),
  ...(allowedHostnames.length > 0 ? { allowedHostnames } : {}),
};

/** Human verification only runs when explicitly enabled and a secret exists. */
export function isTurnstileEnabled(): boolean {
  return turnstileConfig.enabled && Boolean(turnstileConfig.secretKey);
}
