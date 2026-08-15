import assert from "node:assert/strict";
import test from "node:test";

import { requiresEmailDelivery } from "../../lib/auth/email/requirements.js";
import { EMAIL_OTP_OPTIONS } from "../../lib/auth/email/options.js";

test("stores Email OTP values as Better Auth hashes", () => {
  assert.equal(EMAIL_OTP_OPTIONS.storeOTP, "hashed");
});

test("forced verification requires a provider before email/password sign-up", () => {
  assert.equal(requiresEmailDelivery("/sign-up/email", true), true);
});

test("disabled verification keeps the existing sign-up path unguarded", () => {
  assert.equal(requiresEmailDelivery("/sign-up/email", false), false);
});

test("missing-provider guard does not block password or Email OTP login", () => {
  assert.equal(requiresEmailDelivery("/sign-in/email", true), false);
  assert.equal(requiresEmailDelivery("/sign-in/email-otp", true), false);
});

test("mail-delivery endpoints remain guarded when they actually send mail", () => {
  assert.equal(requiresEmailDelivery("/send-verification-email", false), true);
  assert.equal(requiresEmailDelivery("/request-password-reset", false), true);
  assert.equal(
    requiresEmailDelivery("/email-otp/send-verification-otp", false),
    true,
  );
});
