import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const RESULT_CARD_SOURCE = readFileSync(
  "features/knowledge/search/components/result-card.tsx",
  "utf8",
);

test("Knowledge result card does not convert score into a percentage", () => {
  assert.doesNotMatch(RESULT_CARD_SOURCE, /score\s*\*\s*100/);
  assert.doesNotMatch(RESULT_CARD_SOURCE, /Math\.round\([^)]*score[^)]*\)/);
});

test("Knowledge result card keeps rank as the visible ordering indicator", () => {
  assert.match(RESULT_CARD_SOURCE, /hit\.rank/);
  assert.match(RESULT_CARD_SOURCE, /#\{hit\.rank\}/);
});
