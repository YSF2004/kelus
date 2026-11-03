import assert from "node:assert/strict";
import test from "node:test";
import { gapChoices, readingLines } from "../domain/quick-run.ts";
import { checkpointLines } from "../domain/return-visit.ts";

const sentences = [
  "Osmosis is the net movement of water molecules from a dilute solution to a more concentrated solution.",
  "In a hypotonic solution a plant cell gains water and becomes turgid.",
  "In a hypertonic solution the cell loses water and the membrane pulls away from the wall.",
  "Animal cells have no cell wall, so a red blood cell swells and may burst.",
  "The vacuole shrinks when the cell loses water by osmosis.",
];
const cloze = (quote, answer) => ({ id: answer, kind: "cloze", prompt: `Fill the gap: “${quote.replace(answer, "_____")}”`, modelAnswer: answer, hint: "", explanation: "", sourceQuote: quote, origin: "offline", level: "recall" });
const run = {
  checks: [cloze(sentences[1], "turgid"), cloze(sentences[2], "membrane")],
  explainPrompt: "What is osmosis?",
  explainAnswer: sentences[0],
  explainQuote: sentences[0],
  sentences,
  topic: "Osmosis",
};

test("a new topic reads the lines it asks about, in the order of the notes, at most four", () => {
  const lines = readingLines(run);
  assert.deepEqual(lines.slice(0, 3), sentences.slice(0, 3));
  assert.ok(lines.length >= 2 && lines.length <= 4);
});

test("on a phone a gap offers the answer and three words from the same notes, none already in the sentence", () => {
  const options = gapChoices(run.checks[0], run);
  assert.equal(options.length, 4);
  assert.ok(options.includes("turgid"));
  for (const word of options.filter((option) => option !== "turgid")) assert.doesNotMatch(run.checks[0].prompt.toLowerCase(), new RegExp(`\\b${word.toLowerCase()}\\b`));
  assert.deepEqual(gapChoices(run.checks[0], run), options, "the same order every time");
});

test("a checkpoint mixes two lines from each topic, never two of one topic side by side", () => {
  const lines = checkpointLines([
    { conceptId: "a", name: "Osmosis", lines: [sentences[0], sentences[1], sentences[2]] },
    { conceptId: "b", name: "Cells", lines: [sentences[3], sentences[4], "Root hair cells absorb mineral ions from the soil by active transport."] },
  ], "2026-10-15T10:00:00.000Z");
  assert.deepEqual(lines.map((line) => line.conceptId), ["a", "b", "a", "b"]);
});

test("a gap's wrong words fit the sentence: a noun's slot gets nouns from the notes, not a verb or a comparative", () => {
  const notes = [
    "Demand falls as price rises, because buyers switch to substitutes or buy less.",
    "Supply rises as price rises, because producers can cover higher costs.",
    "The equilibrium price is where the quantity demanded equals the quantity supplied.",
  ];
  const gap = cloze(notes[0], "price");
  const options = gapChoices(gap, { ...run, checks: [gap], sentences: notes });
  assert.equal(options.length, 4);
  assert.ok(options.includes("supply"), "a word the notes use in the same slot: “Supply rises”");
  for (const misfit of ["equals", "cover", "higher"]) assert.ok(!options.includes(misfit), `${misfit} cannot complete the sentence`);
});
