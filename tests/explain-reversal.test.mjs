import assert from "node:assert/strict";
import test from "node:test";
import { explainMatch, reversedRelations } from "../domain/answer-evaluation.ts";

const photosynthesis = "Photosynthesis is the process by which green plants convert light energy into chemical energy stored in glucose.";
const osmosis = "Water moves from a dilute solution to a more concentrated solution.";

test("the page's own words in the reverse direction are caught, named, and never suggested as nailed", () => {
  const wrong = explainMatch("Green plants convert chemical energy into light energy stored in oxygen.", photosynthesis, "Photosynthesis");
  assert.equal(wrong.suggest, "missed");
  assert.ok(wrong.flipped.some((flip) => /light energy into chemical energy/.test(flip.page) && /chemical energy into light energy/.test(flip.said)));
  assert.equal(explainMatch("Water moves from a concentrated solution to a dilute solution.", osmosis, "Osmosis").suggest, "missed");
});

test("correct answers in the student's own words are not marked wrong", () => {
  for (const answer of [
    "Green plants convert light energy into chemical energy stored in glucose.",
    "Plants take the energy in light and turn it into chemical energy, which they store as glucose.",
    "It's how green plants change light energy into chemical energy kept in glucose.",
    "Green plants use sunlight to make glucose, storing the light's energy as chemical energy.",
  ]) {
    const match = explainMatch(answer, photosynthesis, "Photosynthesis");
    assert.equal(match.suggest, "nailed", answer);
    assert.deepEqual(reversedRelations(answer, photosynthesis), [], answer);
  }
  assert.equal(explainMatch("Water goes from the dilute solution to the more concentrated one.", osmosis, "Osmosis").suggest, "nailed");
});

test("a thin answer is still a miss, and a reversal needs both sides: one shared word is not a reversal", () => {
  assert.equal(explainMatch("Plants make oxygen.", photosynthesis, "Photosynthesis").suggest, "missed");
  assert.deepEqual(reversedRelations("Energy goes into energy.", "Light energy is turned into chemical energy."), []);
});
