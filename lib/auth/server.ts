import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";

import { authConfig } from "@/config/auth";
import { emailDeliveryConfigured } from "@/config/email";
import { createBetterAuthEmailCallbacks } from "@/lib/auth/email/callbacks";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordComposition,
} from "@/lib/auth/policies/password";
import { postgresPool } from "@/lib/infrastructure/postgres";

const emailCallbacks = createBetterAuthEmailCallbacks(undefined);
const emailDeliveryRequiredPaths = [
  "/send-verification-email",
  "/request-password-reset",
  "/email-otp/send-verification-otp",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/request-email-change",
];

export const auth = betterAuth({
  ...authConfig,
  database: postgresPool,
  emailVerification: {
    sendVerificationEmail: emailCallbacks.sendVerificationEmail,
    sendOnSignUp: emailDeliveryConfigured,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (
        !emailDeliveryConfigured &&
        emailDeliveryRequiredPaths.includes(ctx.path)
      ) {
        throw APIError.from("BAD_REQUEST", {
          code: "EMAIL_PROVIDER_NOT_CONFIGURED",
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
    requireEmailVerification: emailDeliveryConfigured,
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
