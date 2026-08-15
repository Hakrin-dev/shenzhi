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
      otp: "123456",
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
