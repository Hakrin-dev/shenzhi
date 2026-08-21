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
  assert.equal(validatePasswordPolicy("Abcdefghi1A").lengthValid, false);
  assert.equal(validatePasswordPolicy("Abcdefghi1AB").lengthValid, true);
  assert.equal(
    validatePasswordPolicy(`Aa1${"x".repeat(61)}`).lengthValid,
    true,
  );
  assert.equal(
    validatePasswordPolicy(`Aa1${"x".repeat(62)}`).lengthValid,
    false,
  );
});

test("reports mixed rule results from the first typed character", () => {
  assert.deepEqual(validatePasswordPolicy("A"), {
    valid: false,
    lengthValid: false,
    missing: ["lowercase", "digit"],
  });
});

test("reports the missing composition rules without exposing the password", () => {
  assert.deepEqual(validatePasswordComposition("abcdefghijkl"), {
    valid: false,
    missing: ["uppercase", "digit"],
  });
});
