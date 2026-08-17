import assert from "node:assert/strict";
import test from "node:test";

import {
  validatePasswordComposition,
  validatePasswordPolicy,
} from "../../lib/auth/policies/password.js";

test("accepts passwords with uppercase, lowercase, and digit characters", () => {
  for (const password of ["Abcdefghij12", "StrongPassword123"]) {
    assert.equal(validatePasswordComposition(password).valid, true);
  }
});

test("rejects passwords missing one or more composition rules", () => {
  for (const password of [
    "abcdefghijkl",
    "ABCDEFGHIJKL",
    "123456789012",
    "Abcdefghijkl",
  ]) {
    assert.equal(validatePasswordComposition(password).valid, false);
  }
});

test("rejects passwords outside the Better Auth length range", () => {
  assert.equal(validatePasswordPolicy("Abc123").valid, false);
});

test("reports the missing composition rules without exposing the password", () => {
  assert.deepEqual(validatePasswordComposition("abcdefghijkl"), {
    valid: false,
    missing: ["uppercase", "digit"],
  });
});
