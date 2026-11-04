import assert from "node:assert/strict";
import test from "node:test";
import { buildQuickRun, quickOutcome, quickSummary } from "../domain/quick-run.ts";
import { buildPractice, quoteIsOnPage } from "../domain/content-engine.ts";
import { isDrillable } from "../domain/practice-check.ts";

const page = "Tax incidence describes how the burden of a tax is shared between buyers and sellers.\nThe side of the market that is less elastic bears a larger share of the tax burden.";
const activity = {
  id: "a", conceptId: "c1",
  learn: { title: "Tax Incidence", explanation: "Tax incidence describes how the burden of a tax is shared between buyers and sellers.", keyPoints: ["The side of the market that is less elastic bears a larger share of the tax burden."] },
  retrieve: { prompt: "What does Tax Incidence describe, according to your notes?", hint: "h", explanation: "e", example: "x", modelAnswer: "Tax incidence describes how the burden of a tax is shared between buyers and sellers." },
  apply: { prompt: "p", hint: "h", modelAnswer: "m" },
  sourceReferences: [{ materialId: "m", label: "doc", locator: "Page 6" }],
};

test("a run is up to three checks from the page, never which topic a line is about, then one explanation", async () => {
  const { sortsByTopic } = await import("../domain/quick-run.ts");
  const run = buildQuickRun({ activity, name: "Tax Incidence", siblingNames: ["Tax Incidence", "Total Revenue Test", "Cross-Price Elasticity"] });
  assert.ok(run.checks.length <= 3);
  assert.ok(run.checks.every((item) => !sortsByTopic(item)), "sorting a line into its topic is not recall");
  assert.equal(new Set(run.checks.map((item) => item.prompt)).size, run.checks.length, "no question asked twice");
  assert.ok(run.checks.every((item) => item.kind === "choice" || item.kind === "cloze"));
  assert.ok(run.checks.every((item) => quoteIsOnPage(item.sourceQuote, page)));
  assert.equal(run.explainPrompt, activity.retrieve.prompt);
  assert.equal(new Set(run.checks.map((item) => item.kind)).size, run.checks.length === 2 ? 2 : new Set(run.checks.map((item) => item.kind)).size);
});

test("a page too thin for checks still gets the same run: just the explanation, never the old four-step loop", () => {
  const thin = { ...activity, learn: { ...activity.learn, explanation: "Short.", keyPoints: [] } };
  const run = buildQuickRun({ activity: thin, name: "Tax Incidence", siblingNames: ["Tax Incidence"] });
  assert.ok(run);
  assert.ok(run.checks.length <= 1);
  assert.equal(run.explainPrompt, activity.retrieve.prompt);
  assert.equal(quickOutcome({ right: 0, total: 0, self: "nailed" }), "partial", "a rating alone is not evidence");
  assert.equal(quickOutcome({ right: 0, total: 0, self: "nailed", coverage: { hits: 4, keys: 4 } }), "success", "with no checks the explanation decides");
  assert.equal(quickOutcome({ right: 0, total: 0, self: "nailed", coverage: { hits: 0, keys: 4 } }), "failure", "saying you nailed it does not make an empty explanation a pass");
  assert.equal(quickSummary({ right: 0, total: 0, self: "partly" }), "No quick check was suitable for these notes. You rated your explanation: partly there.");
});

test("scan noise is not readable text, but slide bullets and notation are", async () => {
  const { looksReadable } = await import("../domain/material-intelligence.ts");
  assert.equal(looksReadable("omaliance tet Sralysing fuel co"), false);
  assert.equal(looksReadable("hhhhhhh hhhh hhh hhhh hhhhh"), false);
  assert.equal(looksReadable("Perfect competition: many firms, identical products, free entry, firms are price takers"), true);
  assert.equal(looksReadable("It ignores constant factors, so 3n + 10 is O(n) and O(n log n) is slower."), true);
});

test("the result comes from what was shown; the self-rating can lower it, never raise it", () => {
  assert.equal(quickOutcome({ right: 3, total: 3, self: "nailed" }), "success");
  assert.equal(quickOutcome({ right: 0, total: 3, self: "nailed" }), "failure", "a strong rating cannot rescue wrong checks");
  assert.equal(quickOutcome({ right: 1, total: 3, self: "nailed" }), "failure");
  assert.equal(quickOutcome({ right: 3, total: 3, self: "missed" }), "partial", "a miss caps the result");
  assert.equal(quickOutcome({ right: 0, total: 3, self: "missed" }), "failure");
  assert.equal(quickOutcome({ right: 1, total: 3, self: "partly" }), "failure");
  assert.equal(quickOutcome({ right: 2, total: 3, self: "partly" }), "partial");
  assert.equal(quickOutcome({ right: 0, total: 0, self: "missed" }), "failure");
  assert.equal(quickOutcome({ right: 3, total: 3, self: "partly" }), quickOutcome({ right: 3, total: 3, self: "nailed" }), "partly and nailed weigh the same");
  assert.equal(quickOutcome({ right: 2, total: 3, self: "nailed", coverage: { hits: 1, keys: 5 } }), "partial", "an explanation missing most key ideas pulls it down");
});

test("a first reading never uses an immediate fill-in gap or declares durable mastery", () => {
  const first = buildQuickRun({ activity, name: "Tax Incidence", siblingNames: ["Total Revenue Test"], round: 0, readFirst: true });
  assert.ok(first);
  assert.ok(first.checks.every((check) => check.kind !== "cloze"));
  assert.equal(quickOutcome({ right: first.checks.length, total: first.checks.length, self: "nailed", coverage: { hits: 4, keys: 4 }, readFirst: true }), "partial");
  assert.equal(quickOutcome({ right: 2, total: 2, self: "nailed", readFirst: false }), "success");
});

test("a first reading with only gap questions goes straight to an explanation", () => {
  const quote = "Osmosis moves water toward the more concentrated solution through a partially permeable membrane.";
  const thin = {
    ...activity,
    learn: { title: "Osmosis", explanation: quote, keyPoints: [] },
    retrieve: { ...activity.retrieve, prompt: "Explain osmosis in your own words.", modelAnswer: quote },
    practice: [{ id: "gap", kind: "cloze", prompt: "Osmosis moves water toward the more _____ solution.", modelAnswer: "concentrated", hint: "", explanation: quote, sourceQuote: quote, origin: "offline" }],
  };
  const run = buildQuickRun({ activity: thin, name: "Osmosis", siblingNames: [], readFirst: true });
  assert.ok(run);
  assert.equal(run.checks.length, 0);
  assert.equal(run.explainPrompt, "Explain osmosis in your own words.");
  assert.equal(quickOutcome({ right: 0, total: 0, self: "nailed", readFirst: true }), "partial", "self-rating alone cannot claim mastery");
});

test("the summary says exactly what the outcome is based on", () => {
  assert.equal(quickSummary({ right: 2, total: 3, self: "partly" }), "2 of 3 quick checks right. You rated your explanation: partly there.");
});

test("not sure is named in the summary, and never counts as right", () => {
  assert.equal(quickSummary({ right: 1, total: 3, unsure: 2, self: "partly" }), "1 of 3 quick checks right (2 marked not sure). You rated your explanation: partly there.");
  assert.equal(quickOutcome({ right: 1, total: 3, self: "nailed" }), "failure");
});

test("a later round brings different questions, all still quoting the page", () => {
  const excerpt = "Elasticity measures how far quantity demanded responds to a change in price. Demand is elastic when buyers react strongly to price changes. Demand is inelastic when buyers barely react to price changes. Necessities usually have inelastic demand because there are few substitutes. Luxuries usually have elastic demand because buyers can wait. Income elasticity measures the response of demand to a change in income.";
  const practice = buildPractice({ conceptId: "e", name: "Elasticity", excerpt, locator: "page 2", siblingNames: ["Supply", "Costs"] });
  const activity = { conceptId: "e", practice, sourceReferences: [{ locator: "page 2" }], learn: { explanation: excerpt, keyPoints: [] }, retrieve: { prompt: "Explain it.", modelAnswer: excerpt } };
  const a = buildQuickRun({ activity, name: "Elasticity", siblingNames: [], round: 0 });
  const b = buildQuickRun({ activity, name: "Elasticity", siblingNames: [], round: 1 });
  assert.ok(a && b);
  if (practice.filter(isDrillable).length > 3) assert.notDeepEqual(a.checks.map((c) => c.prompt), b.checks.map((c) => c.prompt));
  assert.notEqual(a.explainPrompt, b.explainPrompt);
  assert.deepEqual(buildQuickRun({ activity, name: "Elasticity", siblingNames: [], round: 1 }).checks, b.checks);
  for (const item of b.checks) assert.ok(quoteIsOnPage(item.sourceQuote, excerpt));
});

test("every built-in sample topic still gets a quick run, even though gaps are stricter", async () => {
  const { createDemoLearningActivities } = await import("../data/demo-learning-activities.ts");
  for (const item of createDemoLearningActivities()) {
    const run = buildQuickRun({ activity: item, name: item.learn.title, siblingNames: ["Supply & Demand", "Elasticity", "Consumer Surplus"] });
    assert.ok(run && run.checks.length >= 2, `${item.conceptId} has no quick run`);
  }
});

const osmosisText = "Osmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. In a hypotonic solution a plant cell gains water and becomes turgid because the cell wall pushes back. In a hypertonic solution the cell loses water and becomes plasmolysed. Animal cells have no cell wall, so in a hypotonic solution they may burst.";
const osmosis = {
  ...activity, conceptId: "osm",
  learn: { title: "Osmosis", explanation: osmosisText, keyPoints: [] },
  retrieve: { ...activity.retrieve, prompt: "What is Osmosis, according to your notes?", modelAnswer: "Osmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution." },
  sourceReferences: [{ materialId: "m", label: "doc", locator: "Section 1" }],
};

test("a run never shows the sentence it later asks you to explain, never names the topic as an answer, and tests each fact once", () => {
  const run = buildQuickRun({ activity: osmosis, name: "Osmosis", siblingNames: ["Active Transport", "Enzymes"] });
  assert.ok(run && run.checks.length >= 2);
  assert.ok(run.checks.every((item) => !item.sourceQuote.startsWith("Osmosis is the movement")), "the definition is saved for the explanation");
  assert.ok(run.checks.every((item) => !/^Which idea/.test(item.prompt)), "the topic name is already on screen");
  assert.equal(new Set(run.checks.map((item) => item.sourceQuote)).size, run.checks.length, "one check per sentence");
  const frames = run.checks.filter((item) => item.kind === "cloze").map((item) => item.prompt.split("_____")[0].trim().split(" ").slice(-2).join(" "));
  assert.equal(new Set(frames).size, frames.length, "no two gaps in the same frame");
  assert.ok(run.checks.some((item) => item.variant === "pair"), "two cases built the same way become one question about telling them apart");
  assert.match(run.extraFact ?? "", /Animal cells/, "the run ends on a line it did not use");
});

test("a wrong answer is shown where it really belongs in the notes", async () => {
  const { whereAnswerBelongs } = await import("../domain/quick-run.ts");
  const run = buildQuickRun({ activity: osmosis, name: "Osmosis", siblingNames: ["Active Transport", "Enzymes"] });
  const gap = run.checks.find((item) => item.kind === "cloze" && item.modelAnswer === "hypertonic");
  assert.ok(gap);
  assert.match(whereAnswerBelongs(gap, "hypotonic", run.sentences) ?? "", /^In a hypotonic solution a plant cell gains water/);
  assert.equal(whereAnswerBelongs(gap, "hypertonic", run.sentences), null, "a right answer needs no contrast");
  assert.equal(whereAnswerBelongs(gap, "zzz", run.sentences), null, "a word not in the notes has nowhere to point");
});

test("pasted notes do not mention a meaningless section number in gap prompts", () => {
  const items = buildPractice({ conceptId: "osm", name: "Osmosis", excerpt: osmosisText, locator: "Section 1", siblingNames: [] });
  assert.ok(items.filter((item) => item.kind === "cloze").every((item) => item.prompt.startsWith("Fill the gap: ")));
});

test("a gap tests the idea, not a describing word, a label, half a name or an example", () => {
  const gaps = (name, excerpt) => buildPractice({ conceptId: "c", name, excerpt, locator: "Page 1", siblingNames: [name, "Other"] }).filter((item) => item.kind === "cloze").map((item) => item.modelAnswer);
  const osmosis = gaps("Osmosis", "Osmosis is the net movement of water molecules from a dilute solution to a more concentrated solution through a partially permeable membrane. In a hypotonic solution a plant cell gains water and becomes turgid, because the cell wall pushes back against the swelling vacuole.\nFigure 7.1 Oxygen diffuses from the alveolus into the blood.");
  assert.ok(!osmosis.includes("swelling"), osmosis.join(", "));
  assert.ok(!osmosis.includes("7.1"), osmosis.join(", "));
  const history = gaps("Nationalism", "Serbia wanted to unite the Slav peoples, and the Black Hand group used violence to achieve it. Necessities such as insulin have inelastic demand. The key concept behind tradeoffs is opportunity cost: every action or inaction has a cost in terms of what could have been done instead.");
  for (const bad of ["Black", "insulin", "terms", "action"]) assert.ok(!history.includes(bad), `${bad} in ${history.join(", ")}`);
});

test("a typed answer is marked the way a fair marker would, and a different word never passes", async () => {
  const { checkAnswer } = await import("../domain/practice-check.ts");
  const gap = (prompt, answer) => ({ kind: "cloze", prompt, modelAnswer: answer });
  const notes = "In a hypotonic solution a cell gains water. In a hypertonic solution it loses water. Price rises and demand falls.";
  const item = gap("Fill the gap: “Water moves to a more _____ solution.”", "concentrated");
  assert.deepEqual(checkAnswer(item, "concentrated"), { right: true, how: "exact" });
  assert.deepEqual(checkAnswer(item, "more concentrated"), { right: true, how: "words" });
  assert.deepEqual(checkAnswer(item, "concentrted"), { right: true, how: "spelling" });
  assert.equal(checkAnswer(item, "dilute").right, false);
  assert.deepEqual(checkAnswer(gap("“The _____ controls what enters.”", "membrane"), "the membranes"), { right: true, how: "words" });
  assert.deepEqual(checkAnswer(gap("“Demand _____ when price rises.”", "decreases"), "decreased"), { right: true, how: "form" });
  assert.deepEqual(checkAnswer(gap("“La _____ fabrique du glucose.”", "photosynthèse"), "photosynthese"), { right: true, how: "spelling" });
  assert.deepEqual(checkAnswer(gap("“About _____ people.”", "17,000"), "17000"), { right: true, how: "exact" });
  assert.deepEqual(checkAnswer(gap("“Above _____ enzymes stop.”", "40 °C"), "40"), { right: true, how: "form" });
  // Opposites and look-alikes are different answers, however close the letters.
  assert.equal(checkAnswer(gap("“In a _____ solution a cell gains water.”", "hypotonic"), "hypertonic", notes).right, false);
  assert.equal(checkAnswer(gap("“Demand is _____.”", "elastic"), "inelastic").right, false);
  assert.equal(checkAnswer(gap("“Demand _____ when price rises.”", "decreases"), "increases").right, false);
  // A one-letter slip that is itself another word in the notes is that word, not a slip.
  assert.equal(checkAnswer(gap("“Demand _____.”", "falls"), "fails", "It fails when the price rises.").right, false);
});

test("a picked sentence is never told where it belongs, and a first visit opens on its lightest check", async () => {
  const { whereAnswerBelongs, readingLoad } = await import("../domain/quick-run.ts");
  const run = buildQuickRun({ activity: osmosis, name: "Osmosis", siblingNames: ["Active Transport", "Enzymes"], readFirst: true });
  const item = run.checks[0];
  assert.equal(whereAnswerBelongs(item, "In a hypotonic solution a plant cell gains water and becomes turgid.", run.sentences), null);
  const loads = run.checks.map(readingLoad);
  assert.deepEqual(loads, [...loads].sort((a, b) => a - b), "lightest first on a first visit");
  if (run.checks.some((check) => check.variant !== "notone")) assert.notEqual(run.checks[0].variant, "notone");
});
