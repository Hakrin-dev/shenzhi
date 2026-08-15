import type { AuthEmailProvider } from "./types";

export type { AuthEmailMessage, AuthEmailProvider } from "./types";

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
