import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildAnswerReason } from "../domain/answer-reason.ts";

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

test("substantive authored reasoning stays supported when it includes the exact source passage", () => {
  const explanation = `Switching is easier because alternatives are available. The source says: “${quote}”`;
  for (const origin of ["offline", "ai"]) {
    const result = buildAnswerReason({ ...item, origin, explanation });
    assert.equal(result.reason, explanation);
    assert.equal(result.grounded, true);
  }
});

test("authored reasoning without the linked passage is not presented as verified", () => {
  const explanation = "Switching to another supplier is easier when alternatives are available, so a price rise causes a larger response.";
  for (const origin of ["offline", "ai"]) {
    const result = buildAnswerReason({ ...item, origin, explanation });
    assert.equal(result.grounded, false);
    assert.doesNotMatch(result.reason, /Switching to another supplier/);
    assert.match(result.reason, /cannot be verified from this evidence/);
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

test("the live study run uses the shared reason builder", () => {
  const component = readFileSync(new URL("../components/QuickRun.tsx", import.meta.url), "utf8");
  assert.match(component, /buildAnswerReason/);
});

test("a gap shown with words to choose from gets the same source-restoring explanation as a typed gap", () => {
  const sourceQuote = "Demand falls as price rises, because buyers switch to substitutes or buy less.";
  const gap = {
    ...item, kind: "choice", variant: undefined, choices: ["equals", "price", "cover", "costs"], correctIndex: 1,
    modelAnswer: "price", sourceQuote, explanation: `The page says: “${sourceQuote}”`,
    prompt: "Which word completes this statement from your notes? “Demand falls as _____ rises, because buyers switch to substitutes or buy less.”",
  };
  const feedback = buildAnswerReason(gap);
  assert.equal(feedback.grounded, true);
  assert.match(feedback.reason, /blank replaces “price”/);
  assert.equal(buildAnswerReason({ ...gap, choices: ["equals", "cover", "price", "costs"], correctIndex: 0, modelAnswer: "equals" }).grounded, false);
});

test("the verdict headline names the exact difference, and only when the evidence supports it", async () => {
  const { feedbackHeadline } = await import("../domain/answer-reason.ts");
  const sourceQuote = "Demand falls as price rises, because buyers switch to substitutes or buy less.";
  const gap = buildAnswerReason({
    ...item, kind: "choice", variant: undefined, choices: ["equals", "price", "cover", "costs"], correctIndex: 1,
    modelAnswer: "price", sourceQuote, explanation: "",
    prompt: "Which word completes this statement from your notes? “Demand falls as _____ rises, because buyers switch to substitutes or buy less.”",
  });
  assert.equal(feedbackHeadline(gap, { right: false, given: "equals" }), "The word is “price”, not “equals”.");
  assert.equal(feedbackHeadline(gap, { right: false, unsure: true }), "The word is “price”.");
  assert.equal(feedbackHeadline(gap, { right: true, given: "price" }), "“price” is the word your notes use.");
  assert.equal(feedbackHeadline(buildAnswerReason(item), { right: false, given: "True" }), "Your notes say “larger”, not “smaller”.");
  assert.equal(feedbackHeadline(buildAnswerReason({ ...item, origin: "ai" }), { right: false }), null);
});
