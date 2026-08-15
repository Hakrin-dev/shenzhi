import type { AuthEmailProvider } from "./types";

export const EMAIL_PROVIDER_NOT_CONFIGURED_CODE =
  "EMAIL_PROVIDER_NOT_CONFIGURED" as const;

export type { AuthEmailMessage, AuthEmailProvider } from "./types";
export {
  AlibabaDirectMailConfigurationError,
  AlibabaDirectMailProvider,
  AlibabaDirectMailProviderError,
  createAlibabaDirectMailProvider,
} from "./alibaba-directmail";
export type {
  AlibabaDirectMailConfig,
  AlibabaDirectMailProviderDependencies,
  DirectMailClient,
  DirectMailClientFactory,
  DirectMailRequest,
} from "./alibaba-directmail";
export { createAuthEmailProvider } from "./factory";

export class AuthEmailProviderNotConfiguredError extends Error {
  constructor() {
    super("Auth email provider is not configured.");
    this.name = "AuthEmailProviderNotConfiguredError";
  }
}

export function requireAuthEmailProvider(
  provider: AuthEmailProvider | undefined,
): AuthEmailProvider {
  if (!provider) {
    throw new AuthEmailProviderNotConfiguredError();
  }

  return provider;
}
