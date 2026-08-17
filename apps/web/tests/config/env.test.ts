import assert from "node:assert/strict";
import test from "node:test";

import {
  optionalEnv,
  parseBooleanEnv,
  parseCommaSeparatedEnv,
} from "../../config/env.js";

function withEnvironment(
  name: string,
  value: string | undefined,
  callback: () => void,
) {
  const original = process.env[name];

  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }

  try {
    callback();
  } finally {
    if (original === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = original;
    }
  }
}

test("optionalEnv trims values and treats blank values as absent", () => {
  withEnvironment("SHENZHI_TEST_OPTIONAL_ENV", "  configured  ", () => {
    assert.equal(optionalEnv("SHENZHI_TEST_OPTIONAL_ENV"), "configured");
  });

  withEnvironment("SHENZHI_TEST_OPTIONAL_ENV", "   ", () => {
    assert.equal(optionalEnv("SHENZHI_TEST_OPTIONAL_ENV"), undefined);
  });
});

test("parseCommaSeparatedEnv trims values and drops empty entries", () => {
  withEnvironment(
    "SHENZHI_TEST_TRUSTED_ORIGINS",
    " https://example.com, , https://admin.example.com  ",
    () => {
      assert.deepEqual(parseCommaSeparatedEnv("SHENZHI_TEST_TRUSTED_ORIGINS"), [
        "https://example.com",
        "https://admin.example.com",
      ]);
    },
  );

  withEnvironment("SHENZHI_TEST_TRUSTED_ORIGINS", " ,  ", () => {
    assert.deepEqual(
      parseCommaSeparatedEnv("SHENZHI_TEST_TRUSTED_ORIGINS"),
      [],
    );
  });
});

test("parseBooleanEnv defaults an unset value to false", () => {
  withEnvironment("AUTH_REQUIRE_EMAIL_VERIFICATION", undefined, () => {
    assert.equal(parseBooleanEnv("AUTH_REQUIRE_EMAIL_VERIFICATION"), false);
  });
});

test("parseBooleanEnv accepts trimmed case-insensitive true and false", () => {
  withEnvironment("AUTH_REQUIRE_EMAIL_VERIFICATION", "  TrUe  ", () => {
    assert.equal(parseBooleanEnv("AUTH_REQUIRE_EMAIL_VERIFICATION"), true);
  });

  withEnvironment("AUTH_REQUIRE_EMAIL_VERIFICATION", "  FaLsE  ", () => {
    assert.equal(parseBooleanEnv("AUTH_REQUIRE_EMAIL_VERIFICATION"), false);
  });
});

test("parseBooleanEnv rejects unsupported values without echoing them", () => {
  const invalidValue = "maybe-secret-value";

  withEnvironment("AUTH_REQUIRE_EMAIL_VERIFICATION", invalidValue, () => {
    assert.throws(
      () => parseBooleanEnv("AUTH_REQUIRE_EMAIL_VERIFICATION"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /AUTH_REQUIRE_EMAIL_VERIFICATION/);
        assert.match(error.message, /true.*false/i);
        assert.doesNotMatch(error.message, new RegExp(invalidValue));
        return true;
      },
    );
  });
});

test("parseBooleanEnv rejects a configured blank value", () => {
  withEnvironment("AUTH_REQUIRE_EMAIL_VERIFICATION", "   ", () => {
    assert.throws(
      () => parseBooleanEnv("AUTH_REQUIRE_EMAIL_VERIFICATION"),
      /AUTH_REQUIRE_EMAIL_VERIFICATION.*true.*false/i,
    );
  });
});
