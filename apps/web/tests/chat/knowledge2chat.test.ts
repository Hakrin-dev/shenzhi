import assert from "node:assert/strict";
import test from "node:test";

import * as conversation from "../../features/chat/services/conversation";
import { isKnownCitation } from "../../features/chat/services/citation-validation";

test("Chat request adapter maps smart-search UI mode to nested Knowledge capability", () => {
  assert.equal(typeof conversation.capabilitiesForEntryMode, "function");
  assert.deepEqual(conversation.capabilitiesForEntryMode("ai"), {
    knowledge: { enabled: true },
  });
  assert.deepEqual(conversation.capabilitiesForEntryMode("search"), {
    knowledge: { enabled: false },
  });

  assert.deepEqual(conversation.chatInputFromComposer({
    entryMode: "ai",
    question: "q",
    mode: "fast",
    model: "m",
    web_search: false,
    attachments: [],
  }), {
    question: "q",
    mode: "fast",
    model: "m",
    web_search: false,
    attachments: [],
    capabilities: { knowledge: { enabled: true } },
  });

  assert.equal(conversation.chatInputFromComposer({
    entryMode: "search",
    question: "ordinary",
    mode: "fast",
    model: "m",
    web_search: false,
    attachments: [],
  }).capabilities.knowledge.enabled, false);
});

test("citation rendering keeps an unknown reference as ordinary text", () => {
  const known = new Set(["1"]);

  assert.equal(isKnownCitation("1", known), true);
  assert.equal(isKnownCitation("99", known), false);
});
