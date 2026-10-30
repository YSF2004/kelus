import assert from "node:assert/strict";
import test from "node:test";
import { buildPractice, maskName, quoteIsOnPage } from "../domain/content-engine.ts";
import { structurePastedText } from "../domain/markdown-pages.ts";
import { buildQuickRun } from "../domain/quick-run.ts";

const prose = [
  "Photosynthesis is the process by which green plants use light energy to make glucose from carbon dioxide and water.",
  "It takes place in the chloroplasts, which contain the green pigment chlorophyll.",
  "The light-dependent reactions happen in the thylakoid membranes and produce ATP and NADPH.",
  "The Calvin cycle happens in the stroma and uses ATP and NADPH to fix carbon dioxide into glucose.",
];
const activity = {
  id: "a", conceptId: "c",
  learn: { title: "Photosynthesis", explanation: prose[0], keyPoints: prose.slice(1) },
  retrieve: { prompt: "What is photosynthesis?", hint: "", explanation: "", example: "", modelAnswer: prose[0] },
  apply: { prompt: "", hint: "", modelAnswer: "" },
  sourceReferences: [{ materialId: "m", label: "x", locator: "Section 1" }],
  practice: buildPractice({ conceptId: "c", name: "Photosynthesis", excerpt: prose.join("\n"), locator: "Section 1", siblingNames: [] }),
};

test("notes written as plain sentences still get two checks on a first visit, as words to choose from the same notes", () => {
  const run = buildQuickRun({ activity, name: "Photosynthesis", siblingNames: [], readFirst: true });
  assert.ok(run.checks.length >= 2, `got ${run.checks.length} checks`);
  for (const check of run.checks) {
    assert.equal(check.kind, "choice");
    assert.equal(check.choices.length, 4);
    assert.equal(check.choices[check.correctIndex], check.modelAnswer);
    assert.ok(quoteIsOnPage(check.sourceQuote, prose.join("\n")));
    assert.match(check.prompt, /^Which word completes this statement from your notes\? “[^“”]*_____[^“”]*”$/);
    // A wrong option is never already in the line it would complete.
    for (const option of check.choices) if (option !== check.modelAnswer) assert.ok(!check.prompt.toLowerCase().includes(` ${option.toLowerCase()} `));
  }
  // A return visit asks for the word itself, as before.
  assert.ok(buildQuickRun({ activity, name: "Photosynthesis", siblingNames: [] }).checks.every((check) => check.kind === "cloze"));
});

test("pasted notes without blank lines are still split at their headings, but a short list is not", () => {
  const text = "Photosynthesis\nPhotosynthesis makes glucose from carbon dioxide and water.\nLimiting factors\nThe rate of photosynthesis is limited by light, carbon dioxide and temperature.\nFactors that matter:\nLight intensity\nCarbon dioxide\nTemperature";
  const out = structurePastedText(text);
  assert.match(out, /^# Photosynthesis$/m);
  assert.match(out, /^# Limiting Factors$/m);
  assert.doesNotMatch(out, /^# (?:Light Intensity|Carbon Dioxide|Temperature)$/m);
});

test("a hidden topic name keeps the verb agreeing: plural without an s, singular, and a modal", () => {
  assert.equal(maskName("Mitochondria release energy from glucose.", "Mitochondria"), "These ideas release energy from glucose.");
  assert.equal(maskName("Osmosis moves water across a membrane.", "Osmosis"), "This idea moves water across a membrane.");
  assert.equal(maskName("Diffusion usually happens down a gradient.", "Diffusion"), "This idea usually happens down a gradient.");
  assert.equal(maskName("Enzymes can be denatured by heat.", "Enzymes"), "This idea can be denatured by heat.");
});
