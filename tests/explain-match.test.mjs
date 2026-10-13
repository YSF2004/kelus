import assert from "node:assert/strict";
import test from "node:test";
import { explainMatch, looksLikeWords } from "../domain/answer-evaluation.ts";

const page = "Osmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution.";

test("the explanation step shows which key words of the page you used and which you left out", () => {
  const match = explainMatch("Water moves across a membrane from where there is more water to less water, from dilute to concentrated.", page, "Osmosis");
  assert.ok(match.missed.includes("partially permeable"), "the missing idea is named as one phrase");
  assert.ok(!match.missed.includes("osmosis"), "the topic name is on screen, so leaving it out is not a gap");
  assert.ok(!match.missed.includes("movement"), "\"moves\" covers \"movement\"");
  assert.equal(match.suggest, "partly");
  assert.equal(match.parts.map((part) => part.text).join(""), page, "the page sentence is shown exactly as written");
});

test("a full explanation in the page's words is suggested as nailed, and an empty one as missed", () => {
  assert.equal(explainMatch("Osmosis is when water moves through a partially permeable membrane from a dilute solution into a concentrated solution.", page, "Osmosis").suggest, "nailed");
  assert.equal(explainMatch("", page, "Osmosis").suggest, "missed");
  assert.equal(explainMatch("It is about cells", page, "Osmosis").suggest, "missed");
});

test("key-mashing is not taken as an explanation", () => {
  assert.equal(looksLikeWords("hhhhhhh"), false);
  assert.equal(looksLikeWords("asdfgh"), false);
  assert.equal(looksLikeWords("Water moves in"), true);
});

const cell = "In a hypotonic solution a plant cell gains water and becomes turgid because the cell wall pushes back.";

test("a word counts in any form of its family, and a near-spelling of another word does not", async () => {
  const { family, sameFamily } = await import("../domain/explain-words.ts");
  for (const [a, b] of [["movement", "moving"], ["turgid", "turgidity"], ["dilute", "dilution"], ["concentrated", "concentration"], ["permeable", "permeability"], ["studies", "study"]]) {
    assert.ok(sameFamily(family(a), family(b)), `${a} ~ ${b}`);
  }
  for (const [a, b] of [["plant", "planet"], ["membrane", "member"], ["cell", "cellulose"]]) {
    assert.ok(!sameFamily(family(a), family(b)), `${a} !~ ${b}`);
  }
  const match = explainMatch("The plant cell takes in water and becomes turgidity, the wall pushes back.", cell);
  assert.ok(!match.missed.some((phrase) => /gains|turgid/.test(phrase)), match.missed.join(" / "));
});

test("an everyday word for the same idea counts: rises for increases, takes in for gains", () => {
  const page2 = "When the price increases, the quantity demanded decreases.";
  const match = explainMatch("If the price rises, people demand a smaller quantity, it drops.", page2);
  assert.ok(!match.missed.includes("increases"), match.missed.join(" / "));
  assert.ok(!match.missed.includes("decreases"), match.missed.join(" / "));
  assert.deepEqual(match.flipped, []);
});

test("the opposite is never a match, is named, and stops a full mark", () => {
  const match = explainMatch("In a hypotonic solution the plant cell loses water, becomes turgid and the cell wall pushes back.", cell);
  assert.deepEqual(match.flipped, [{ page: "gains", said: "loses" }]);
  assert.equal(match.parts.find((part) => part.text === "gains")?.hit, false);
  assert.ok(!match.missed.includes("gains"), "an opposite is named once, as an opposite, not also as left out");
  assert.equal(match.suggest, "partly");
});

test("a page that says both directions cannot be contradicted by one of them", () => {
  const both = "A plant cell gains water in a hypotonic solution and loses water in a hypertonic solution.";
  assert.deepEqual(explainMatch("The cell gains water in a hypotonic solution.", both).flipped, []);
});
