import assert from "node:assert/strict";
import test from "node:test";

import { memoryAdapter } from "better-auth/adapters/memory";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";

import {
  persistTurnstileClientCookie,
  TURNSTILE_ANON_ID_COOKIE,
  TURNSTILE_CLIENT_ID_CONTEXT_KEY,
  TURNSTILE_SEND_OTP_PATH,
} from "../../lib/auth/captcha/turnstile.js";

const TEST_SECRET = "test-secret-that-is-at-least-thirty-two-characters";

function createAuthWithBaseURL(baseURL: string) {
  return betterAuth({
    secret: TEST_SECRET,
    baseURL,
    database: memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
    }),
    logger: { disabled: true },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== TURNSTILE_SEND_OTP_PATH) return;
        if (ctx.getHeader("x-captcha-response") !== "valid-test-token") {
          return ctx.error("BAD_REQUEST", {
            code: "MISSING_RESPONSE",
            message: "Missing CAPTCHA response",
          });
        }

        return {
          context: { [TURNSTILE_CLIENT_ID_CONTEXT_KEY]: "test-client-id" },
        };
      }),
      after: persistTurnstileClientCookie,
    },
    plugins: [
      emailOTP({
        disableSignUp: true,
        async sendVerificationOTP() {},
      }),
    ],
  });
}

function sendOtpRequest(baseURL: string) {
  return new Request(`${baseURL}/api/auth${TURNSTILE_SEND_OTP_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseURL,
      "x-captcha-response": "valid-test-token",
    },
    body: JSON.stringify({ email: "person@example.com", type: "sign-in" }),
  });
}

test("a successful CAPTCHA persists the anonymous client id cookie", async () => {
  const auth = createAuthWithBaseURL("http://localhost:3000");
  const response = await auth.handler(sendOtpRequest("http://localhost:3000"));

  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.equal(response.status, 200);
  assert.match(setCookie, new RegExp(TURNSTILE_ANON_ID_COOKIE));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  // http 基础地址不下发 Secure,避免在 http://localhost 下被浏览器丢弃。
  assert.doesNotMatch(setCookie, /Secure/i);
});

test("the anonymous client id cookie is Secure for https base URLs", async () => {
  const auth = createAuthWithBaseURL("https://example.com");
  const response = await auth.handler(sendOtpRequest("https://example.com"));

  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.equal(response.status, 200);
  assert.match(setCookie, new RegExp(TURNSTILE_ANON_ID_COOKIE));
  assert.match(setCookie, /Secure/i);
});

test("the before hook cookie survives when it returns an error afterwards", async () => {
  const auth = betterAuth({
    secret: TEST_SECRET,
    baseURL: "http://localhost:3000",
    database: memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
    }),
    logger: { disabled: true },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== TURNSTILE_SEND_OTP_PATH) return;
        if (ctx.getHeader("x-captcha-response") !== "valid-test-token") {
          return ctx.error("BAD_REQUEST", {
            code: "MISSING_RESPONSE",
            message: "Missing CAPTCHA response",
          });
        }

        ctx.setCookie(TURNSTILE_ANON_ID_COOKIE, "test-client-id", {
          httpOnly: true,
          sameSite: "Lax",
          secure: false,
          maxAge: 60 * 60 * 24 * 365,
          path: "/",
        });

        return ctx.error("BAD_REQUEST", {
          code: "EMAIL_PROVIDER_NOT_CONFIGURED",
          message: "Email delivery is not configured.",
        });
      }),
    },
    plugins: [
      emailOTP({
        disableSignUp: true,
        async sendVerificationOTP() {},
      }),
    ],
  });

  const response = await auth.handler(sendOtpRequest("http://localhost:3000"));
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.equal(response.status, 400);
  assert.match(setCookie, new RegExp(TURNSTILE_ANON_ID_COOKIE));
  assert.doesNotMatch(setCookie, /Secure/i);
});
