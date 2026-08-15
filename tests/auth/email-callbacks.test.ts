import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthEmailProviderNotConfiguredError,
} from "../../lib/auth/providers/email/index.js";
import { createBetterAuthEmailCallbacks } from "../../lib/auth/email/callbacks.js";

test("email OTP callback fails clearly when no provider is configured", async () => {
  const callbacks = createBetterAuthEmailCallbacks(undefined);

  await assert.rejects(
    callbacks.sendVerificationOTP({
      email: "person@example.com",
      otp: "redacted-otp",
      type: "sign-in",
    }),
    AuthEmailProviderNotConfiguredError,
  );
});

test("verification and reset callbacks fail clearly without a provider", async () => {
  const callbacks = createBetterAuthEmailCallbacks(undefined);
  const user = {
    id: "user-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    email: "person@example.com",
    emailVerified: false,
    name: "Person",
  };

  await assert.rejects(
    callbacks.sendVerificationEmail({
      user,
      url: "https://example.com/verify?token=redacted",
      token: "redacted",
    }),
    AuthEmailProviderNotConfiguredError,
  );

  await assert.rejects(
    callbacks.sendResetPassword({
      user,
      url: "https://example.com/reset?token=redacted",
      token: "redacted",
    }),
    AuthEmailProviderNotConfiguredError,
  );
});

test("verification, reset, and OTP callbacks share one provider", async () => {
  const messages: Array<{ subject: string; to: string }> = [];
  const callbacks = createBetterAuthEmailCallbacks({
    send: async (message) => {
      messages.push({ subject: message.subject, to: message.to });
    },
  });
  const user = {
    id: "user-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    email: "person@example.com",
    emailVerified: false,
    name: "Person",
  };

  await callbacks.sendVerificationEmail({
    user,
    url: "https://example.com/verify?token=redacted",
    token: "redacted",
  });
  await callbacks.sendResetPassword({
    user,
    url: "https://example.com/reset?token=redacted",
    token: "redacted",
  });
  await callbacks.sendVerificationOTP({
    email: user.email,
    otp: "redacted-otp",
    type: "sign-in",
  });

  assert.deepEqual(messages, [
    { subject: "验证你的深知邮箱", to: "person@example.com" },
    { subject: "重置你的深知密码", to: "person@example.com" },
    { subject: "你的深知验证码", to: "person@example.com" },
  ]);
});
