import assert from "node:assert/strict";
import test from "node:test";

import { optionalEnv, parseCommaSeparatedEnv } from "../../config/env.js";

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
