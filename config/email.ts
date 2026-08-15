import { optionalEnv } from "./env";

/**
 * Provider-neutral email deployment configuration.
 *
 * These values describe the future provider boundary only. They do not
 * select or instantiate a provider, and they intentionally contain no
 * provider-specific credentials.
 */
export const emailConfig = {
  provider: optionalEnv("AUTH_EMAIL_PROVIDER"),
  sender: optionalEnv("AUTH_EMAIL_SENDER"),
  senderName: optionalEnv("AUTH_EMAIL_SENDER_NAME"),
  replyTo: optionalEnv("AUTH_EMAIL_REPLY_TO"),
};
