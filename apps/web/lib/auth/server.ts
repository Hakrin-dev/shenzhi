import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";

import {
  authConfig,
  getAuthEmailVerificationSettings,
} from "@/config/auth";
import { emailDeliveryConfigured } from "@/config/email";
import { githubOAuthConfig } from "@/config/oauth";
import { turnstileConfig } from "@/config/turnstile";
import {
  getClientIP,
  persistTurnstileVerificationCookie,
  shouldEnforceTurnstile,
  TURNSTILE_VERIFIED_CONTEXT_KEY,
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
import {
  generateRandomOAuthPassword,
  OAUTH_CREDENTIAL_PROVIDER_ID,
} from "@/lib/auth/providers/oauth/credential";
import { registrationEmailVerification } from "@/lib/auth/plugins/registration-email-verification";

const betterAuthConfig = authConfig;

const socialProviders = githubOAuthConfig
  ? {
      github: {
        clientId: githubOAuthConfig.clientId,
        clientSecret: githubOAuthConfig.clientSecret,
      },
    }
  : undefined;
const emailVerificationSettings = getAuthEmailVerificationSettings();
const { requireEmailVerification } = emailVerificationSettings;
const emailCallbacks = createBetterAuthEmailCallbacks(
  createAuthEmailProvider(),
);

export const auth = betterAuth({
  ...betterAuthConfig,
  database: postgresPool,
  ...(socialProviders ? { socialProviders } : {}),
  emailVerification: {
    sendVerificationEmail: emailCallbacks.sendVerificationEmail,
    sendOnSignUp: emailVerificationSettings.sendOnSignUp,
    autoSignInAfterVerification:
      emailVerificationSettings.autoSignInAfterVerification,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      let shouldRememberTurnstile = false;

      // 人机验证:发送验证码前需先通过 Turnstile,通过一次后以签名 Cookie 记住。
      if (shouldEnforceTurnstile(ctx.path, turnstileConfig.enabled)) {
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

            shouldRememberTurnstile = true;
          }
        }
      }

      if (
        !emailDeliveryConfigured &&
        requiresEmailDelivery(ctx.path)
      ) {
        return ctx.error("BAD_REQUEST", {
          code: EMAIL_PROVIDER_NOT_CONFIGURED_CODE,
          message: "Email delivery is not configured.",
        });
      }

      const isSignUp = ctx.path === "/sign-up/email";
      const isNewPasswordOperation =
        ctx.path === "/reset-password" || ctx.path === "/change-password";

      if (!isSignUp && !isNewPasswordOperation) {
        return shouldRememberTurnstile
          ? {
              context: {
                [TURNSTILE_VERIFIED_CONTEXT_KEY]: true,
              },
            }
          : undefined;
      }

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
    after: persistTurnstileVerificationCookie,
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    requireEmailVerification,
    sendResetPassword: emailCallbacks.sendResetPassword,
    revokeSessionsOnPasswordReset: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user, context) => {
          // 仅在 OAuth 回调首次创建用户时补齐 credential 凭证。
          // 邮箱/密码注册路径由 sign-up/email 自行写入 credential,
          // 这里避免重复创建。
          if (!context?.path.startsWith("/callback/")) return;

          const password = generateRandomOAuthPassword();
          const hash = await context.context.password.hash(password);

          await context.context.internalAdapter.linkAccount({
            userId: user.id,
            providerId: OAUTH_CREDENTIAL_PROVIDER_ID,
            accountId: user.id,
            password: hash,
          });
        },
      },
    },
  },
  plugins: [
    emailOTP({
      ...EMAIL_OTP_OPTIONS,
      sendVerificationOnSignUp:
        emailVerificationSettings.sendVerificationOnSignUp,
      overrideDefaultEmailVerification:
        emailVerificationSettings.overrideDefaultEmailVerification,
      sendVerificationOTP: emailCallbacks.sendVerificationOTP,
    }),
    registrationEmailVerification({
      sendVerificationOTP: emailCallbacks.sendVerificationOTP,
    }),
  ],
});
