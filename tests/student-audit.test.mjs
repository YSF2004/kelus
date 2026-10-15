import assert from "node:assert/strict";
import test from "node:test";
import { buildPractice, units } from "../domain/content-engine.ts";
import { explainMatch } from "../domain/answer-evaluation.ts";
import { coreName, versusSides } from "../domain/material-intelligence.ts";
import { progressSummary } from "../domain/progress.ts";

test("a line break after e.g. does not end the sentence", () => {
  assert.deepEqual(units("• Normative analysis is the study of the way that things should be (e.g.\nshould organ sales be legal?)."), [
    "Normative analysis is the study of the way that things should be (e.g. should organ sales be legal?).",
  ]);
});

test("a chapter-title topic is asked about by its subject, and an A vs. B topic by both sides", () => {
  assert.equal(coreName("Introduction to Microeconomics"), "Microeconomics");
  assert.equal(coreName("Osmosis"), "Osmosis");
  assert.deepEqual(versusSides("Positive vs. normative economics")?.left, "Positive economics");
  assert.equal(versusSides("Diffusion"), null);
});

test("frame words and the page's own example are not key words to remember", () => {
  const match = explainMatch("Water moves.", "Positive analysis is the study of the way things are (e.g. eBay auctions).", "Positive vs. normative economics");
  const keys = match.parts.filter((part) => part.key).map((part) => part.text.replace(/[^\p{L}]/gu, "").toLowerCase());
  assert.ok(!keys.includes("study") && !keys.includes("ebay") && !keys.includes("auctions"));
  assert.ok(keys.includes("positive"), "in A vs. B, the two names are the point");
});

test("no gap is cut from a bracketed example", () => {
  const items = buildPractice({ conceptId: "p", name: "Positive vs. normative economics", excerpt: "Positive analysis is the study of the way things are (e.g. eBay auctions).", locator: "Page 1", siblingNames: [] });
  assert.ok(!items.some((item) => item.kind === "cloze" && /auctions/i.test(item.modelAnswer)));
});

test("progress lists every topic you tried, latest first", () => {
  const now = new Date(2026, 9, 10, 12).getTime();
  const at = (hour) => new Date(2026, 9, 10, hour).toISOString();
  const concepts = ["a", "b", "c"].map((id) => ({ id, name: id, mastery: 0.2, examImportance: 1, courseId: "c" }));
  const events = [
    { conceptId: "a", kind: "retrieval", outcome: "partial", createdAt: at(9), masteryBefore: 0, masteryAfter: 0.2 },
    { conceptId: "b", kind: "retrieval", outcome: "failure", createdAt: at(10), masteryBefore: 0, masteryAfter: 0.1 },
  ];
  const s = progressSummary({ concepts, events, nowMs: now, daysToExam: 9 });
  assert.deepEqual(s.practised.map((t) => t.id), ["b", "a"]);
  assert.deepEqual(s.notStarted.map((t) => t.id), ["c"]);
});
