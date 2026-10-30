import assert from "node:assert/strict";
import test from "node:test";
import { buildMatchRound, matchOrder } from "../domain/match-round.ts";

const concept = (id, name) => ({ id, name });
const activity = (conceptId, explanation) => ({ conceptId, learn: { explanation } });
const concepts = [concept("a", "Diffusion"), concept("b", "Osmosis"), concept("c", "Active transport"), concept("d", "Turgor")];
const activities = [
  activity("a", "Diffusion is the net movement of particles from a region of higher concentration to a lower one."),
  activity("b", "Osmosis is the net movement of water molecules across a partially permeable membrane."),
  activity("c", "Active transport moves substances against a concentration gradient, using energy from respiration."),
  activity("d", "Short."),
];

test("a match round pairs each practised topic with its own line, the name hidden", () => {
  const pairs = buildMatchRound(["a", "b", "c", "d"], concepts, activities);
  assert.deepEqual(pairs.map((pair) => pair.name), ["Diffusion", "Osmosis", "Active transport"]);
  for (const pair of pairs) assert.doesNotMatch(pair.line, new RegExp(pair.name, "i"), "the line never gives its topic away");
  assert.match(pairs[0].line, /^This idea is the net movement of particles/);
});

test("fewer than three usable topics give no round", () => {
  assert.deepEqual(buildMatchRound(["a", "d"], concepts, activities), []);
});

test("the lines are never shown in the topics' own order", () => {
  const pairs = buildMatchRound(["a", "b", "c"], concepts, activities);
  for (const seed of ["s1", "s2", "s3", "s4", "s5"]) {
    const order = matchOrder(pairs, seed);
    assert.equal(order.length, 3);
    assert.ok(order.some((pair, index) => pair.conceptId !== pairs[index].conceptId), seed);
  }
});
