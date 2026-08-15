import type { User } from "better-auth";

import type { AuthEmailProvider } from "@/lib/auth/providers/email";

import {
  buildEmailOtpMessage,
  buildPasswordResetEmailMessage,
  buildVerificationEmailMessage,
  type EmailOtpType,
} from "./messages";

export interface BetterAuthEmailLinkCallbackData {
  user: User;
  url: string;
  token: string;
}

export interface BetterAuthEmailOtpCallbackData {
  email: string;
  otp: string;
  type: EmailOtpType;
}

export function createBetterAuthEmailCallbacks(
  provider: AuthEmailProvider,
) {
  return {
    sendVerificationEmail: async (
      data: BetterAuthEmailLinkCallbackData,
      _request?: Request,
    ) => {
      void _request;
      await provider.send(
        buildVerificationEmailMessage({ user: data.user, url: data.url }),
      );
    },
    sendResetPassword: async (
      data: BetterAuthEmailLinkCallbackData,
      _request?: Request,
    ) => {
      void _request;
      await provider.send(
        buildPasswordResetEmailMessage({ user: data.user, url: data.url }),
      );
    },
    sendVerificationOTP: async (
      data: BetterAuthEmailOtpCallbackData,
      _context?: unknown,
    ) => {
      void _context;
      await provider.send(buildEmailOtpMessage(data));
    },
  };
}
