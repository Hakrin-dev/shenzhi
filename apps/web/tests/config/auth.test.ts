import assert from "node:assert/strict";
import test from "node:test";

import { getAuthEmailVerificationSettings } from "../../config/auth.js";

test("disabled email verification maps both Better Auth flags to false", () => {
  assert.deepEqual(getAuthEmailVerificationSettings(false), {
    sendOnSignUp: false,
    sendVerificationOnSignUp: false,
    overrideDefaultEmailVerification: true,
    autoSignInAfterVerification: false,
    requireEmailVerification: false,
  });
});

test("enabled email verification maps both Better Auth flags to true", () => {
  assert.deepEqual(getAuthEmailVerificationSettings(true), {
    sendOnSignUp: true,
    sendVerificationOnSignUp: false,
    overrideDefaultEmailVerification: true,
    autoSignInAfterVerification: true,
    requireEmailVerification: true,
  });
});
