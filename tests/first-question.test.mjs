import assert from "node:assert/strict";
import test from "node:test";
import { ownWordsLead } from "../domain/content-engine.ts";
import { buildQuickRun, quickOutcome } from "../domain/quick-run.ts";
import { explainMatch } from "../domain/answer-evaluation.ts";
import { lineMove } from "../domain/leitner.ts";
import { recallMap } from "../domain/recall-map.ts";
import { attemptedToday } from "../lib/today-attempt.ts";

const nowIso = "2026-10-24T10:00:00.000Z";

const biology = "The plasma membrane is a phospholipid bilayer. Each phospholipid has a hydrophilic head and two hydrophobic tails. The hydrophilic heads face the watery fluid inside and outside the cell, while the hydrophobic tails point inward, away from water. The membrane is selectively permeable because its hydrophobic core lets small nonpolar molecules pass but blocks ions and large polar molecules.";
const maths = "A quadratic equation has the form ax² + bx + c = 0, where a is not zero. The discriminant is b² − 4ac. When the discriminant is positive, the equation has two distinct real roots. When the discriminant is zero, the equation has exactly one repeated real root. When the discriminant is negative, there are no real roots.";
const history = "The tax burden fell on the Third Estate, while the clergy and nobility were largely exempt. Enlightenment ideas about rights and popular sovereignty undermined the legitimacy of absolute monarchy. A poor harvest in 1788 doubled the price of bread in Paris. Louis XVI called the Estates-General in 1789 to raise new taxes.";

const words = (text) => text.toLocaleLowerCase().match(/\p{L}{4,}/gu) ?? [];

for (const [subject, name, excerpt] of [["biology", "Cell Membranes", biology], ["maths", "Quadratic equations", maths], ["history", "Causes of the French Revolution", history]]) {
  test(`${subject}: the first question asks for thinking from the notes, and never shows its own answer`, () => {
    const lead = ownWordsLead({ name, excerpt });
    assert.ok(lead, `${subject} notes hold an own-words question`);
    // Grounded: what the answer is compared with is in the notes, word for word.
    assert.ok(excerpt.includes(lead.answer), "the answer comes from the notes");
    for (const line of lead.lines) assert.ok(excerpt.includes(line.replace(/\.$/, "")), "every compared line is a line of the notes");
    // Not a restated sentence: the answer's key words are not printed in the question.
    const shown = new Set(words(lead.prompt));
    const hidden = words(lead.answer).filter((word) => !shown.has(word));
    assert.ok(hidden.length >= 3, `the question leaves at least three key words to recall (${lead.prompt})`);
    assert.ok(!/Which (?:idea|term)/.test(lead.prompt), "not a term-matching check");
  });
}

test("each subject gets a form that suits it: biology a reason, maths a condition to apply, history an explanation from two terms", () => {
  assert.equal(ownWordsLead({ name: "Cell Membranes", excerpt: biology }).kind, "why");
  assert.equal(ownWordsLead({ name: "Quadratic equations", excerpt: maths }).kind, "apply");
  assert.equal(ownWordsLead({ name: "Causes of the French Revolution", excerpt: history }).kind, "explain");
  assert.match(ownWordsLead({ name: "Quadratic equations", excerpt: maths }).prompt, /^Suppose the discriminant is positive\. What happens/);
});

test("notes too thin for a fair open question get none, and the run says so instead of pretending", () => {
  assert.equal(ownWordsLead({ name: "Osmosis", excerpt: "Osmosis is water." }), null);
  const activity = {
    id: "a", conceptId: "c",
    learn: { title: "Elasticity", explanation: "Price elasticity of demand measures responsiveness to price.", keyPoints: ["Elastic demand reacts strongly to price."] },
    retrieve: { prompt: "What does elasticity measure?", hint: "", explanation: "", example: "", modelAnswer: "Price elasticity of demand measures responsiveness to price." },
    apply: { prompt: "p", hint: "h", modelAnswer: "m" },
    sourceReferences: [{ materialId: "m", label: "doc", locator: "Page 1" }],
  };
  const run = buildQuickRun({ activity, name: "Elasticity", siblingNames: ["Elasticity", "Supply", "Demand", "Tax"] });
  assert.ok(run);
  assert.equal(run.explainFirst, false);
  if (run.checks.length) assert.match(run.explainNote ?? "", /don’t hold a fair open question/);
});

test("a run with an own-words question opens on it, and compares the answer with the notes' own lines", () => {
  const activity = {
    id: "a", conceptId: "mem",
    learn: { title: "Cell Membranes", explanation: biology, keyPoints: [] },
    retrieve: { prompt: "What is the plasma membrane?", hint: "", explanation: "", example: "", modelAnswer: "The plasma membrane is a phospholipid bilayer." },
    apply: { prompt: "p", hint: "h", modelAnswer: "m" },
    sourceReferences: [{ materialId: "m", label: "doc", locator: "Page 1" }],
  };
  const run = buildQuickRun({ activity, name: "Cell Membranes", siblingNames: ["Cell Membranes", "Osmosis", "Active Transport", "Diffusion"] });
  assert.equal(run.explainFirst, true);
  assert.match(run.explainPrompt, /selectively permeable.*Why\?/);
  assert.equal(run.explainLines.length, 1);
  assert.ok(biology.includes(run.explainLines[0]));
});

test("answer outcomes: a weak answer names what is missing; a full one is recognised; an unmeasurable one is not graded", () => {
  const lead = ownWordsLead({ name: "Cell Membranes", excerpt: biology });
  const named = `Cell Membranes ${lead.given}`;
  const weak = explainMatch("It lets things through.", lead.answer, named);
  assert.equal(weak.suggest, "missed");
  assert.ok(weak.missed.some((phrase) => /hydrophobic/.test(phrase)), "the missing idea is named from the notes");
  const full = explainMatch("Its hydrophobic core lets small nonpolar molecules pass but it blocks ions and large polar molecules.", lead.answer, named);
  assert.equal(full.suggest, "nailed");
  // Too few key words to compare: no suggestion is trusted, so the run treats it as needing review, never a pass.
  const tiny = explainMatch("Water.", "Water moves.", "Osmosis");
  assert.ok(tiny.keys < 3);
  // A self-rating alone is never a pass.
  assert.equal(quickOutcome({ right: 0, total: 0, self: "nailed" }), "partial");
});

test("consequences: a line's move follows the five-box rule exactly, and is said plainly", () => {
  const quote = "The membrane is selectively permeable.";
  assert.deepEqual(lineMove({ quote, result: "right", known: [], nowIso }), { from: 1, to: 2, text: "This line moves from Box 1 to Box 2. Kelus asks it again in 2 days." });
  assert.deepEqual(lineMove({ quote, result: "missed", known: [], nowIso }).text, "This line stays in Box 1. It comes back first in your next review.");
  const known = [{ conceptId: "c", name: "n", quote, at: "2026-10-20T09:00:00.000Z", streak: 2 }];
  assert.equal(lineMove({ quote, result: "missed", known, nowIso }).text, "This line goes back from Box 3 to Box 1. It comes back first in your next review.");
  assert.equal(lineMove({ quote, result: "right", known, nowIso }).to, 4);
  const today = [{ ...known[0], at: "2026-10-24T08:00:00.000Z" }];
  assert.match(lineMove({ quote, result: "right", known: today, nowIso }).text, /^Already answered right today, so it stays in Box 3/);
  assert.match(lineMove({ quote, result: "review", known: [], nowIso }).text, /^Needs review: Kelus can’t measure this answer fairly/);
});

test("a missed own-words line shows on the line map even when no quick check quotes it", () => {
  const concepts = [{ id: "mem", name: "Cell Membranes", courseId: "c" }];
  const activities = [{ conceptId: "mem", practice: [], retrieve: { modelAnswer: "The plasma membrane is a phospholipid bilayer." } }];
  const missed = [{ conceptId: "mem", name: "Cell Membranes", quote: "The membrane is selectively permeable because its hydrophobic core lets small nonpolar molecules pass but blocks ions and large polar molecules.", at: nowIso }];
  const map = recallMap({ concepts, activities, known: [], missed, nowIso });
  assert.ok(map.topics[0].lines.some((line) => line.state === "back" && line.quote.startsWith("The membrane is selectively")));
});

test("Study acknowledges a topic answered today, and says honestly that it stays first", () => {
  const missed = [{ conceptId: "mem", name: "Cell Membranes", quote: "q1", at: "2026-10-24T09:30:00.000Z" }];
  const known = [{ conceptId: "mem", name: "Cell Membranes", quote: "q2", at: "2026-10-24T09:31:00.000Z", streak: 1 }];
  assert.equal(attemptedToday({ conceptId: "mem", name: "Cell Membranes", known: [], missed, nowIso, open: true }), "You started Cell Membranes today: 1 line missed. The missed line stays in Box 1 and comes back first, so Cell Membranes stays first.");
  assert.equal(attemptedToday({ conceptId: "mem", name: "Cell Membranes", known, missed, nowIso, open: true }), "You started Cell Membranes today: 1 line right, 1 missed. The missed line stays in Box 1 and comes back first, so Cell Membranes stays first.");
  assert.equal(attemptedToday({ conceptId: "mem", name: "Cell Membranes", known, missed: [], nowIso, open: true }), "You started Cell Membranes today: 1 line right. Finish it to complete the topic.");
  // Yesterday's answers are not today's: nothing is claimed.
  assert.equal(attemptedToday({ conceptId: "mem", name: "Cell Membranes", known: [], missed: [{ ...missed[0], at: "2026-10-23T09:30:00.000Z" }], nowIso, open: true }), null);
});

test("route consequence: a real reorder is shown before and after with the planner's reason; no change shows nothing", async () => {
  const { routeChange } = await import("../lib/route-change.ts");
  const names = new Map([["a", "Osmosis"], ["b", "Diffusion"], ["c", "Active transport"]]);
  const reasons = new Map([["c", ["PREREQUISITE_GAP"]]]);
  const change = routeChange({ before: ["a", "b", "c"], after: ["c", "a", "b"], names, reasons });
  assert.deepEqual(change.before, ["Osmosis", "Diffusion", "Active transport"]);
  assert.deepEqual(change.after, ["Active transport", "Osmosis", "Diffusion"]);
  assert.equal(change.text, "Active transport moved from 3rd to 1st because your answer showed a gap in something it builds on.");
  // Without a recorded reason it says only what happened, never an invented why.
  assert.equal(routeChange({ before: ["a", "b"], after: ["b", "a"], names, reasons: new Map() }).text, "Diffusion moved from 2nd to 1st after your answer.");
  // Same order: nothing to show, so nothing is animated.
  assert.equal(routeChange({ before: ["a", "b", "c"], after: ["a", "b", "c"], names, reasons }), null);
  assert.equal(routeChange({ before: ["a"], after: ["a"], names, reasons }), null);
});
