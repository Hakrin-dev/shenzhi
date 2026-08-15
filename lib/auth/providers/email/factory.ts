import {
  emailConfig,
  getAlibabaDirectMailConfig,
  type EmailConfig,
} from "../../../../config/email";

import { createAlibabaDirectMailProvider } from "./alibaba-directmail";
import type { AuthEmailProvider } from "./types";

/**
 * Resolve the configured auth email provider without failing application
 * startup when deployment email settings are not present yet.
 */
export function createAuthEmailProvider(
  source: EmailConfig = emailConfig,
): AuthEmailProvider | undefined {
  const config = getAlibabaDirectMailConfig(source);
  if (!config) return undefined;

  return createAlibabaDirectMailProvider(config);
}
