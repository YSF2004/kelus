import assert from "node:assert/strict";
import test from "node:test";
import { buildPractice, quoteIsOnPage } from "../domain/content-engine.ts";
import { lintQuestion } from "../domain/question-lint.ts";

const page = "Price elasticity of demand measures how strongly the quantity demanded responds to a change in price. Close substitutes make demand more elastic because buyers can switch when the price rises. Necessities such as medicine usually have inelastic demand because there are few substitutes. When demand is inelastic, a price rise increases total revenue for the seller. When demand is elastic, a price rise decreases total revenue.";
const items = buildPractice({ conceptId: "ped", name: "Price elasticity of demand", excerpt: page, locator: "Page 2", siblingNames: ["Supply and demand", "Fiscal policy"] });

test("'what happens when' asks what the notes say follows, with the other case as a wrong option", () => {
  const q = items.find((item) => item.variant === "predict" && /when demand is inelastic/.test(item.prompt));
  assert.ok(q);
  assert.equal(q.modelAnswer, "A price rise increases total revenue for the seller");
  assert.ok(q.choices.includes("A price rise decreases total revenue"));
  assert.ok(q.choices.every((choice) => !/^when /i.test(choice)), "no option is another case");
  assert.ok(quoteIsOnPage(q.sourceQuote, page));
});

test("'does NOT match' shows three lines exactly as written and one with a direction word turned around", () => {
  const q = items.find((item) => item.variant === "notone");
  assert.ok(q);
  const truths = q.choices.filter((_, index) => index !== q.correctIndex);
  assert.equal(truths.length, 3);
  for (const line of truths) assert.ok(page.includes(line.replace(/\.$/, "")), line);
  assert.ok(!page.includes(q.modelAnswer.replace(/\.$/, "")), "the odd one out is not on the page");
  assert.ok(page.includes(q.sourceQuote));
});

test("the new questions pass the same quality checks as the rest", () => {
  for (const item of items.filter((i) => i.variant === "predict" || i.variant === "notone")) assert.deepEqual(lintQuestion(item), []);
});

test("true or false shows one line as written or with one word turned around, and the answer matches the notes", () => {
  const q = items.find((item) => item.variant === "truefalse");
  assert.ok(q, "a true-or-false question is written from this page");
  assert.deepEqual(q.choices, ["True", "False"]);
  assert.match(q.prompt, /^True or false, from your notes: “.+”$/);
  const shown = q.prompt.slice(q.prompt.indexOf("“") + 1, -1);
  // True exactly when the line is shown as the notes say it.
  assert.equal(q.modelAnswer === "True", shown === q.sourceQuote);
  assert.equal(q.choices[q.correctIndex], q.modelAnswer);
  assert.ok(quoteIsOnPage(q.sourceQuote, page));
  assert.deepEqual(lintQuestion(q), []);
});
