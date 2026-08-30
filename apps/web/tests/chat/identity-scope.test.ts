import assert from "node:assert/strict";
import test from "node:test";

import { chatIdentityScope } from "../../features/chat/services/identity-scope";

test("Chat identity scopes distinguish anonymous and authenticated workspaces", () => {
  assert.equal(chatIdentityScope(null), "anonymous");
  assert.equal(chatIdentityScope(undefined), "anonymous");
  assert.equal(chatIdentityScope("anonymous"), "user:anonymous");
  assert.equal(chatIdentityScope("user-1"), "user:user-1");
});
