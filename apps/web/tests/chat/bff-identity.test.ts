import assert from "node:assert/strict";
import test from "node:test";

import { attachIdentity } from "../../clients/backend/identity";

test("BFF distinguishes an anonymous session from a Better Auth failure", async () => {
  const outgoing = new Headers();
  assert.equal(await attachIdentity(new Headers(), outgoing, async () => null), "anonymous");
  assert.equal(outgoing.has("x-shenzhi-user-id"), false);

  await assert.rejects(
    attachIdentity(new Headers(), outgoing, async () => { throw new Error("database unavailable"); }),
    /database unavailable/,
  );
});

test("BFF attaches only identity returned by Better Auth", async () => {
  const outgoing = new Headers();
  const result = await attachIdentity(new Headers(), outgoing, async () => ({
    user: { id: "user-1", email: "user@example.com" },
  }));
  assert.equal(result, "authenticated");
  assert.equal(outgoing.get("x-shenzhi-user-id"), "user-1");
  assert.equal(outgoing.get("x-shenzhi-user-email"), "user@example.com");
});
