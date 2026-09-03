import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeInternalReturnTo } from "../../lib/navigation/internal-return-to";
import {
  paperReferenceHref,
} from "../../features/chat/services/reference-navigation";
import type { ChatReference } from "../../types/ai-search";

const paper: ChatReference = {
  referenceId: "1",
  resourceType: "paper",
  resourceId: "opaque/paper?id=1",
  title: "Paper",
  content: "abstract",
  metadata: { authors: [], year: null, venue: null },
};

test("Chat paper links carry the current internal Chat URL as returnTo", () => {
  const returnTo = "/agents/ask?session=opaque%2Fsession%3Fv%3D1";

  assert.equal(normalizeInternalReturnTo(returnTo), returnTo);
  assert.equal(
    paperReferenceHref(paper, returnTo),
    "/knowledge/search/opaque%2Fpaper%3Fid%3D1?returnTo=%2Fagents%2Fask%3Fsession%3Dopaque%252Fsession%253Fv%253D1",
  );
});

test("Paper Detail rejects external, protocol-relative, and malformed returnTo values", () => {
  const route = readFileSync("app/knowledge/search/[paperId]/page.tsx", "utf8");
  const detail = readFileSync("features/knowledge/paper/KnowledgePaperDetailPage.tsx", "utf8");
  const grid = readFileSync("features/chat/components/reference-grid.tsx", "utf8");
  assert.match(route, /searchParams/);
  assert.match(route, /normalizeInternalReturnTo/);
  assert.match(detail, /返回对话/);
  assert.match(detail, /返回论文检索/);
  assert.match(grid, /\}, \[references\.length\]\);/);
  assert.equal(normalizeInternalReturnTo("https://evil.example/phish"), null);
  assert.equal(normalizeInternalReturnTo("//evil.example/phish"), null);
  assert.equal(normalizeInternalReturnTo("javascript:alert(1)"), null);
  assert.equal(normalizeInternalReturnTo("/agents\\ask"), null);
  assert.equal(normalizeInternalReturnTo("/agents/ask?x=hello world"), null);
  assert.equal(normalizeInternalReturnTo("/agents/ask?session=opaque"), "/agents/ask?session=opaque");
});

test("paper return preserves the URL session as the sole restore target", () => {
  const hook = readFileSync("features/chat/hooks/use-chat-session.ts", "utf8");
  const returnTarget = "/agents/ask?session=S1";

  assert.equal(normalizeInternalReturnTo(returnTarget), returnTarget);
  assert.match(hook, /initialSessionId/);
  assert.match(hook, /void openSession\(urlSessionId\)/);
  assert.equal((hook.match(/void openSession\(urlSessionId\)/g) ?? []).length, 1);
  assert.match(hook, /phaseForRestoredStatus/);
});
