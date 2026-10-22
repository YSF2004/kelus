import assert from "node:assert/strict";
import test from "node:test";
import { leitner } from "../domain/leitner.ts";
import { nextStreak } from "../lib/known-lines.ts";

const concepts = [{ id: "c1", name: "Diffusion", courseId: "k" }];
const activities = [{ conceptId: "c1", practice: [
  { kind: "choice", sourceQuote: "Particles spread out." },
  { kind: "cloze", sourceQuote: "It needs no energy." },
  { kind: "choice", sourceQuote: "Down a gradient." },
], retrieve: { modelAnswer: "Net movement from high to low." } }];
const now = "2026-10-22T12:00:00.000Z";

test("new and missed lines sit in Box 1; a recalled line moves one box per day it was recalled", () => {
  const state = leitner({ concepts, activities, nowIso: now,
    known: [{ conceptId: "c1", name: "Diffusion", quote: "Particles spread out.", at: now, streak: 1 }, { conceptId: "c1", name: "Diffusion", quote: "It needs no energy.", at: now, streak: 3 }],
    missed: [{ conceptId: "c1", name: "Diffusion", quote: "Down a gradient.", at: now }] });
  const box = (quote) => state.lines.find((line) => line.quote === quote).box;
  assert.equal(box("Particles spread out."), 2);
  assert.equal(box("It needs no energy."), 4);
  assert.equal(box("Down a gradient."), 1);
  assert.equal(state.lines.find((line) => line.quote === "Down a gradient.").state, "missed");
  assert.equal(box("Net movement from high to low."), 1);
  assert.equal(state.byBox[0].length, 2);
  assert.equal(state.recalled, 2);
});

test("the box never passes 5, and a second right answer the same day does not move a line", () => {
  const state = leitner({ concepts, activities, nowIso: now, missed: [], known: [{ conceptId: "c1", name: "Diffusion", quote: "Particles spread out.", at: now, streak: 9 }] });
  assert.equal(state.lines.find((line) => line.quote === "Particles spread out.").box, 5);
  assert.equal(nextStreak({ conceptId: "c1", name: "D", quote: "q", at: "2026-10-21T09:00:00Z", streak: 2 }, "2026-10-21T18:00:00Z"), 2);
  assert.equal(nextStreak({ conceptId: "c1", name: "D", quote: "q", at: "2026-10-20T09:00:00Z", streak: 2 }, "2026-10-21T18:00:00Z"), 3);
  assert.equal(nextStreak(undefined, now), 1);
});

test("a line recalled today is marked as moved today; one recalled on an earlier day is not", () => {
  const state = leitner({ concepts, activities, nowIso: now, missed: [], known: [
    { conceptId: "c1", name: "Diffusion", quote: "Particles spread out.", at: now, streak: 1 },
    { conceptId: "c1", name: "Diffusion", quote: "It needs no energy.", at: "2026-10-19T09:00:00.000Z", streak: 2 },
  ] });
  const line = (quote) => state.lines.find((item) => item.quote === quote);
  assert.equal(line("Particles spread out.").movedToday, true);
  assert.equal(line("It needs no energy.").movedToday, false);
  assert.equal(line("Down a gradient.").movedToday, false);
});
