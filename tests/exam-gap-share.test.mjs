import assert from "node:assert/strict";
import test from "node:test";
import { examGapShareText } from "../lib/exam-gap-share.ts";

test("exam-gap sharing contains counts only, never student prompt or source content", () => {
  const text = examGapShareText({ promptCount: 4, unmatchedPromptCount: 2 });
  assert.match(text, /4 past-paper prompts/);
  assert.match(text, /2 prompts have no confirmed support/);
  assert.doesNotMatch(text, /source line|answer|notes text/i);
});

test("a fully supported exam focus is shareable without claiming a grade", () => {
  const text = examGapShareText({ promptCount: 1, unmatchedPromptCount: 0 });
  assert.match(text, /Every prompt has a confirmed source-backed study topic/);
  assert.doesNotMatch(text, /grade|mark|predict/i);
});
