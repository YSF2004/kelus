import assert from "node:assert/strict";
import test from "node:test";
import { ownWordsLead } from "../domain/content-engine.ts";
import { explainMatch } from "../domain/answer-evaluation.ts";
import { COURSES } from "./fixtures/question-corpus.mjs";

const topics = { "Cell Membranes": "The plasma membrane is a phospholipid bilayer. Each phospholipid has a hydrophilic head and two hydrophobic tails. The hydrophilic heads face the watery fluid inside and outside the cell, while the hydrophobic tails point inward, away from water. The membrane is selectively permeable because its hydrophobic core lets small nonpolar molecules pass but blocks ions and large polar molecules.", "Quadratic equations": "A quadratic equation has the form ax² + bx + c = 0, where a is not zero. The discriminant is b² − 4ac. When the discriminant is positive, the equation has two distinct real roots. When the discriminant is zero, the equation has exactly one repeated real root. When the discriminant is negative, there are no real roots." };
for (const data of Object.values(COURSES)) Object.assign(topics, data.topics);
// [topic, right answers in other words, wrong answers]
const cases = [
  ["Cell Membranes", ["The middle of the membrane is water-fearing, so small non-polar molecules get through but ions and big polar molecules are stopped.", "Its hydrophobic centre lets little nonpolar molecules cross but keeps out ions and large polar ones.", "Because the inside is hydrophobic: small uncharged nonpolar molecules can go through, charged ions and large polar molecules can't."], ["Because it has pores that let everything in.", "Because of proteins that pump water.", "It is made of carbohydrates."]],
  ["Quadratic equations", ["There are two different real solutions.", "You get 2 distinct real roots.", "the equation has two separate real roots"], ["There are no real roots.", "It has one repeated root.", "The parabola has no solution."]],
  ["Price elasticity of demand", ["The seller's total revenue goes up when the price rises.", "Raising the price increases the seller's total revenue.", "Total revenue rises for the seller."], ["Total revenue falls for the seller.", "Demand stops completely.", "Nothing happens to revenue."]],
  ["Binary search", ["You repeat the search on the left half.", "Search again in the left half of the list.", "Keep looking only in the left half."], ["Search the right half.", "Start again from the beginning of the array.", "Stop, the item is missing."]],
  ["Le Chatelier's principle", ["The equilibrium moves toward the products.", "The position of equilibrium shifts to the right, towards the products.", "It shifts in favour of the products."], ["The equilibrium shifts toward the reactants.", "Nothing changes.", "The reaction stops."]],
  ["Circular motion", ["It flies off in a straight line along the tangent, not outwards along the radius.", "The object travels in a straight line tangent to the circle, not out along the radius.", "It goes straight on along the tangent rather than outward radially."], ["It moves outward along the radius.", "It keeps going in a circle.", "It falls to the centre."]],
  ["Fiscal policy", ["The government uses its spending and taxes to influence the economy; in a recession it spends more or cuts taxes to boost aggregate demand.", "It is government spending and taxation used to steer the economy. Expansionary policy raises spending or lowers taxes to increase aggregate demand in a recession.", "Using government spending and taxation to affect the economy, and in a recession spending more or cutting taxes so aggregate demand rises."], ["It is when the central bank changes interest rates.", "Raising taxes during a recession to reduce demand.", "Printing money to pay debts."]],
];

/**
 * A bench of real first questions with answers written the way students write: right ones in other words, wrong ones
 * that share the notes' vocabulary. Checking compares key words, not meaning, so the bar is about fairness: a right
 * answer is never marked a miss, and a wrong one never earns full credit.
 */
test("answer checking is fair to right answers in other words and never credits wrong ones", () => {
  const tally = { right: { nailed: 0, partly: 0, missed: 0 }, wrong: { nailed: 0, partly: 0, missed: 0 } };
  for (const [name, rights, wrongs] of cases) {
    const lead = ownWordsLead({ name, excerpt: topics[name] });
    assert.ok(lead, `${name} has a first question`);
    const named = `${name} ${lead.given}`;
    for (const answer of rights) {
      const match = explainMatch(answer, lead.answer, named);
      assert.ok(match.keys >= 3, `${name}: the question can be measured`);
      assert.notEqual(match.suggest, "missed", `${name}: a right answer in other words is not a miss: “${answer}”`);
      tally.right[match.suggest] += 1;
    }
    for (const answer of wrongs) {
      const match = explainMatch(answer, lead.answer, named);
      assert.notEqual(match.suggest, "nailed", `${name}: a wrong answer never earns full credit: “${answer}”`);
      tally.wrong[match.suggest] += 1;
    }
  }
  assert.ok(tally.right.nailed >= 17, `right answers recognised in full: ${tally.right.nailed} of 21`);
  assert.ok(tally.wrong.missed >= 20, `wrong answers marked as a miss: ${tally.wrong.missed} of 21`);
});

test("plain words for terms, numbers, contradictions and what the notes rule out", () => {
  const membrane = "its hydrophobic core lets small nonpolar molecules pass but blocks ions and large polar molecules";
  assert.ok(explainMatch("the water-fearing middle lets small non-polar molecules through", membrane, "Cell Membranes").hits >= 4, "water-fearing is hydrophobic, middle is core, through is pass");
  // A number is the same number in a figure, and a different one is a contradiction.
  assert.equal(explainMatch("2 distinct real roots", "the equation has two distinct real roots", "Quadratic equations").suggest, "nailed");
  const none = explainMatch("there are no real roots", "the equation has two distinct real roots", "Quadratic equations");
  assert.equal(none.suggest, "missed");
  assert.deepEqual(none.flipped[0], { page: "two", said: "no" });
  // Saying the opposite of the notes' relation is a miss, not partial credit.
  assert.equal(explainMatch("Total revenue falls for the seller.", "a price rise increases total revenue for the seller", "Price elasticity of demand").suggest, "missed");
  // What the notes rule out is not a key idea: saying it earns nothing.
  const tangent = "the object moves off in a straight line along the tangent, not outward along the radius";
  assert.equal(explainMatch("It moves outward along the radius.", tangent, "Circular motion").suggest, "missed");
  assert.equal(explainMatch("The object flies off in a straight line along the tangent.", tangent, "Circular motion").suggest, "nailed");
});
