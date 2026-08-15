import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";

import {
  authConfig,
  getAuthEmailVerificationSettings,
} from "@/config/auth";
import { emailDeliveryConfigured } from "@/config/email";
import { createBetterAuthEmailCallbacks } from "@/lib/auth/email/callbacks";
import { requiresEmailDelivery } from "@/lib/auth/email/requirements";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordComposition,
} from "@/lib/auth/policies/password";
import { postgresPool } from "@/lib/infrastructure/postgres";
import {
  createAuthEmailProvider,
  EMAIL_PROVIDER_NOT_CONFIGURED_CODE,
} from "@/lib/auth/providers/email";

const {
  requireEmailVerification: configuredRequireEmailVerification,
  ...betterAuthConfig
} = authConfig;
const requireEmailVerification =
  getAuthEmailVerificationSettings(configuredRequireEmailVerification)
    .requireEmailVerification;
const emailCallbacks = createBetterAuthEmailCallbacks(
  createAuthEmailProvider(),
);

export const auth = betterAuth({
  ...betterAuthConfig,
  database: postgresPool,
  emailVerification: {
    sendVerificationEmail: emailCallbacks.sendVerificationEmail,
    sendOnSignUp: requireEmailVerification,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (
        !emailDeliveryConfigured &&
        requiresEmailDelivery(ctx.path, requireEmailVerification)
      ) {
        throw APIError.from("BAD_REQUEST", {
          code: EMAIL_PROVIDER_NOT_CONFIGURED_CODE,
          message: "Email delivery is not configured.",
        });
      }

      const isSignUp = ctx.path === "/sign-up/email";
      const isNewPasswordOperation =
        ctx.path === "/reset-password" || ctx.path === "/change-password";

      if (!isSignUp && !isNewPasswordOperation) return;

      const password = isSignUp
        ? ctx.body?.password
        : ctx.body?.newPassword;
      if (typeof password !== "string") return;

      if (!validatePasswordComposition(password).valid) {
        throw APIError.from("BAD_REQUEST", {
          code: "PASSWORD_POLICY_VIOLATION",
          message: "Password must include uppercase, lowercase, and a number.",
        });
      }
    }),
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    requireEmailVerification,
    sendResetPassword: emailCallbacks.sendResetPassword,
    revokeSessionsOnPasswordReset: true,
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      rateLimit: {
        window: 60,
        max: 3,
      },
      sendVerificationOTP: emailCallbacks.sendVerificationOTP,
    }),
  ],
});
