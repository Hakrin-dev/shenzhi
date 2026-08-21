import assert from "node:assert/strict";
import test from "node:test";

import { memoryAdapter } from "better-auth/adapters/memory";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";

import {
  persistTurnstileVerificationCookie,
  TURNSTILE_SEND_OTP_PATH,
  TURNSTILE_VERIFIED_CONTEXT_KEY,
  TURNSTILE_VERIFIED_COOKIE,
} from "../../lib/auth/captcha/turnstile.js";

const BASE_URL = "http://localhost:3000";
const TEST_SECRET = "test-secret-that-is-at-least-thirty-two-characters";

function sendOtpRequest(cookie?: string) {
  return new Request(`${BASE_URL}/api/auth${TURNSTILE_SEND_OTP_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE_URL,
      ...(cookie
        ? { cookie }
        : { "x-captcha-response": "valid-test-token" }),
    },
    body: JSON.stringify({ email: "person@example.com", type: "sign-in" }),
  });
}

test("a successful CAPTCHA is remembered for an OTP resend", async () => {
  const database: Record<string, Array<Record<string, unknown>>> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const auth = betterAuth({
    secret: TEST_SECRET,
    baseURL: BASE_URL,
    database: memoryAdapter(database),
    logger: { disabled: true },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== TURNSTILE_SEND_OTP_PATH) return;

        const verified = await ctx.getSignedCookie(
          TURNSTILE_VERIFIED_COOKIE,
          ctx.context.secret,
        );
        if (verified === "1") return;
        if (ctx.getHeader("x-captcha-response") !== "valid-test-token") {
          return ctx.error("BAD_REQUEST", {
            code: "MISSING_RESPONSE",
            message: "Missing CAPTCHA response",
          });
        }

        return {
          context: { [TURNSTILE_VERIFIED_CONTEXT_KEY]: true },
        };
      }),
      after: persistTurnstileVerificationCookie,
    },
    plugins: [
      emailOTP({
        disableSignUp: true,
        async sendVerificationOTP() {},
      }),
    ],
  });

  const firstResponse = await auth.handler(sendOtpRequest());
  const setCookie = firstResponse.headers.get("set-cookie") ?? "";
  const verificationCookie = setCookie.split(";")[0];

  assert.equal(firstResponse.status, 200);
  assert.match(setCookie, new RegExp(TURNSTILE_VERIFIED_COOKIE));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);

  const resendResponse = await auth.handler(sendOtpRequest(verificationCookie));
  assert.equal(resendResponse.status, 200);
});
