import assert from "node:assert/strict";
import test from "node:test";

import { getAuthEmailVerificationSettings } from "../../config/auth.js";

test("staged registration avoids duplicate mail while protecting old users", () => {
  assert.deepEqual(getAuthEmailVerificationSettings(), {
    sendOnSignUp: false,
    sendVerificationOnSignUp: false,
    overrideDefaultEmailVerification: true,
    autoSignInAfterVerification: false,
    requireEmailVerification: true,
  });
});
