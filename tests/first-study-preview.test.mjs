import assert from "node:assert/strict";
import test from "node:test";
import { buildFirstStudyExample } from "../lib/first-study-preview.ts";
import { readFileSync } from "node:fs";

test("the first-use question has a supported answer and an exact passage from the example", () => {
  const example = buildFirstStudyExample();
  assert.ok(example, "The first-use sample must remain usable when the question generator changes.");
  assert.ok(example.title);
  assert.ok(example.check.explanation.trim());
  assert.equal(example.check.choices[example.check.correctIndex], example.check.modelAnswer);
  assert.ok(example.sentences.some((sentence) => sentence.trim() === example.check.sourceQuote.trim()));
  assert.equal(example.check.origin, "offline");
});

test("rebuilding the sample does not mutate a learner snapshot or the earlier example", () => {
  const first = buildFirstStudyExample();
  const before = structuredClone(first);
  const second = buildFirstStudyExample();
  assert.deepEqual(first, before);
  assert.deepEqual(second, first);
  assert.notEqual(second, first);
});

test("the preview is first-use-only and its dependencies exclude learner persistence and pilot tracking", () => {
  const entry = readFileSync(new URL("../components/DropNotes.tsx", import.meta.url), "utf8");
  const component = readFileSync(new URL("../components/FirstStudyPreview.tsx", import.meta.url), "utf8");
  const factory = readFileSync(new URL("../lib/first-study-preview.ts", import.meta.url), "utf8");
  assert.match(entry, /\{first \? <FirstStudyPreview \/> : null\}/);
  assert.ok(entry.indexOf("<FirstStudyPreview") < entry.indexOf('className={`setup-first-upload'));
  for (const source of [component, factory]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|trackEvent|useLearner|material-store|material-sync/);
  }
});
