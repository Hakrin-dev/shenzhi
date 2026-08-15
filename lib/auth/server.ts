import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";

import {
  authConfig,
  getAuthEmailVerificationSettings,
} from "@/config/auth";
import { emailDeliveryConfigured } from "@/config/email";
import { turnstileConfig } from "@/config/turnstile";
import {
  getClientIP,
  shouldEnforceTurnstile,
  TURNSTILE_VERIFIED_COOKIE,
  verifyCloudflareTurnstileToken,
} from "@/lib/auth/captcha/turnstile";
import { createBetterAuthEmailCallbacks } from "@/lib/auth/email/callbacks";
import { EMAIL_OTP_OPTIONS } from "@/lib/auth/email/options";
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
      // 人机验证:发送验证码前需先通过 Turnstile,通过一次后以签名 Cookie 记住。
      if (shouldEnforceTurnstile(ctx.path)) {
        const turnstileSecretKey = turnstileConfig.secretKey;
        if (turnstileSecretKey) {
          const verified = await ctx.getSignedCookie(
            TURNSTILE_VERIFIED_COOKIE,
            ctx.context.secret,
          );

          if (verified !== "1") {
            const token = ctx.getHeader("x-captcha-response");
            if (!token) {
              return ctx.error("BAD_REQUEST", {
                code: "MISSING_RESPONSE",
                message: "Missing CAPTCHA response",
              });
            }

            const valid = await verifyCloudflareTurnstileToken({
              token,
              secretKey: turnstileSecretKey,
              remoteIP: getClientIP(ctx.request),
              expectedAction: turnstileConfig.expectedAction,
              allowedHostnames: turnstileConfig.allowedHostnames,
            });

            if (!valid) {
              return ctx.error("FORBIDDEN", {
                code: "VERIFICATION_FAILED",
                message: "Captcha verification failed",
              });
            }

            await ctx.setSignedCookie(
              TURNSTILE_VERIFIED_COOKIE,
              "1",
              ctx.context.secret,
              {
                httpOnly: true,
                sameSite: "Lax",
                secure: process.env.NODE_ENV === "production",
                maxAge: 60 * 60 * 24,
                path: "/",
              },
            );
          }
        }
      }

      if (
        !emailDeliveryConfigured &&
        requiresEmailDelivery(ctx.path, requireEmailVerification)
      ) {
        return ctx.error("BAD_REQUEST", {
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
        return ctx.error("BAD_REQUEST", {
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
      ...EMAIL_OTP_OPTIONS,
      sendVerificationOTP: emailCallbacks.sendVerificationOTP,
    }),
  ],
});
