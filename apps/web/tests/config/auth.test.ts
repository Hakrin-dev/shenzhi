import assert from "node:assert/strict";
import test from "node:test";

import { getAuthEmailVerificationSettings } from "../../config/auth.js";

test("disabled email verification maps both Better Auth flags to false", () => {
  assert.deepEqual(getAuthEmailVerificationSettings(false), {
    sendOnSignUp: false,
    requireEmailVerification: false,
  });
});

test("enabled email verification maps both Better Auth flags to true", () => {
  assert.deepEqual(getAuthEmailVerificationSettings(true), {
    sendOnSignUp: true,
    requireEmailVerification: true,
  });
});
