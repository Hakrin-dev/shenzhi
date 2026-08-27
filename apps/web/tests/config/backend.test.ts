import assert from "node:assert/strict";
import test from "node:test";

import { backendConnectionIsAllowed } from "../../config/backend.js";

test("backend credential is required unless loopback development is explicitly enabled", () => {
  assert.equal(backendConnectionIsAllowed({ secret: "configured", url: "https://backend.example.com", allowInsecureLocal: false }), true);
  assert.equal(backendConnectionIsAllowed({ secret: undefined, url: "http://127.0.0.1:8000", allowInsecureLocal: false }), false);
  assert.equal(backendConnectionIsAllowed({ secret: undefined, url: "http://127.0.0.1:8000", allowInsecureLocal: true }), true);
  assert.equal(backendConnectionIsAllowed({ secret: undefined, url: "https://backend.example.com", allowInsecureLocal: true }), false);
});
