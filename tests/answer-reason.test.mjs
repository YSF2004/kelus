import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildAnswerReason } from "../domain/answer-reason.ts";
import { buildFirstStudyExample } from "../lib/first-study-preview.ts";

const quote = "Close substitutes make switching easier, so the response is usually larger.";
const item = {
  id: "comparison", kind: "choice", variant: "truefalse", origin: "offline",
  prompt: `True or false, from your notes: “${quote.replace("larger", "smaller")}”`,
  choices: ["True", "False"], correctIndex: 1, modelAnswer: "False",
  sourceQuote: quote, explanation: `The notes say: “${quote}”`, hint: "",
};

test("feedback names the precise changed claim instead of just repeating the economics quotation", () => {
  const feedback = buildAnswerReason(item);
  assert.equal(feedback.answer, "False");
  assert.equal(feedback.grounded, true);
  assert.match(feedback.reason, /statement says “smaller”/);
  assert.match(feedback.reason, /source says “larger”/);
});

test("the same comparison works for another subject without fixed economics reasoning", () => {
  const sourceQuote = "Increasing temperature increases the rate of reaction in this range.";
  const feedback = buildAnswerReason({
    ...item, sourceQuote, explanation: `The notes say: “${sourceQuote}”`,
    prompt: `True or false: “${sourceQuote.replace("increases", "decreases")}”`,
  });
  assert.match(feedback.reason, /“decreases”/);
  assert.match(feedback.reason, /“increases”/);
  assert.doesNotMatch(feedback.reason, /elastic|demand|substitute/);
});

test("an unchanged true statement has a source-preserving explanation", () => {
  const feedback = buildAnswerReason({ ...item, correctIndex: 0, modelAnswer: "True", prompt: `True or false: “${quote}”` });
  assert.equal(feedback.grounded, true);
  assert.match(feedback.reason, /same wording/);
});

test("a template never claims a changed mathematical sign is unchanged", () => {
  const feedback = buildAnswerReason({
    ...item, correctIndex: 0, modelAnswer: "True",
    sourceQuote: "The solution satisfies x < 5.", prompt: "True or false: “The solution satisfies x > 5.”",
    explanation: "",
  });
  assert.equal(feedback.grounded, false);
});

test("substantive authored reasoning is preserved, including for AI questions", () => {
  const explanation = "Switching to another supplier is easier when alternatives are available, so a price rise causes a larger response.";
  for (const origin of ["offline", "ai"]) {
    assert.equal(buildAnswerReason({ ...item, origin, explanation }).reason, explanation);
  }
});

test("the gap explanation is derived only when its replacement restores the source", () => {
  const sourceQuote = "Osmosis moves water toward the more concentrated solution.";
  const gap = {
    ...item, kind: "cloze", variant: undefined, choices: undefined, correctIndex: undefined,
    modelAnswer: "concentrated", sourceQuote,
    prompt: "Fill the gap: “Osmosis moves water toward the more _____ solution.”",
    explanation: `The page says: “${sourceQuote}”`,
  };
  assert.match(buildAnswerReason(gap).reason, /blank replaces “concentrated”/);
  assert.equal(buildAnswerReason({ ...gap, modelAnswer: "dilute" }).grounded, false);
});

test("missing passages, missing reasoning and inconsistent keys are acknowledged rather than invented", () => {
  assert.equal(buildAnswerReason({ ...item, sourceQuote: "" }).grounded, false);
  assert.match(buildAnswerReason({ ...item, sourceQuote: "" }).reason, /cannot be verified/);
  assert.match(buildAnswerReason({ ...item, correctIndex: 0 }).reason, /inconsistent/);
  assert.equal(buildAnswerReason({ ...item, origin: "ai" }).grounded, false);
  assert.doesNotThrow(() => buildAnswerReason({ ...item, explanation: undefined, sourceQuote: undefined }));
});

test("large rewrites do not get an invented contrast explanation", () => {
  const result = buildAnswerReason({ ...item, prompt: "True or false: “An unrelated long claim about a completely different experiment and its results.”" });
  assert.equal(result.grounded, false);
});

test("source fragments remain in their original language while interface reasoning is English", () => {
  const sourceQuote = "Une hausse du prix provoque une baisse de la demande.";
  const result = buildAnswerReason({
    ...item, sourceQuote, explanation: `The notes say: “${sourceQuote}”`,
    prompt: `True or false: “${sourceQuote.replace("baisse", "hausse")}”`,
  });
  assert.match(result.reason, /“hausse”/);
  assert.match(result.reason, /“baisse”/);
});

test("the sample and the live run use the same reason builder without changing the answer or source", () => {
  const example = buildFirstStudyExample();
  const before = structuredClone(example.check);
  assert.equal(buildAnswerReason(example.check).grounded, true);
  assert.deepEqual(example.check, before);
  for (const path of ["QuickRun.tsx", "FirstStudyPreview.tsx"]) {
    const component = readFileSync(new URL(`../components/${path}`, import.meta.url), "utf8");
    assert.match(component, /buildAnswerReason/);
  }
});
