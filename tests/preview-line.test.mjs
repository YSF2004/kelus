import assert from "node:assert/strict";
import test from "node:test";
import { previewLine } from "../domain/preview-line.ts";

test("a topic is introduced by a line that reads as a sentence, not a run of labels", () => {
  const excerpt = "route Departure time fight operation flight monitoring and crew future fights.\nThe operation manager monitors every flight from departure to arrival and plans the crew for future flights.";
  assert.equal(previewLine(excerpt), "The operation manager monitors every flight from departure to arrival and plans the crew for future flights.");
});

test("with no sentence in the section, its opening stands in, cut at a word", () => {
  const labels = "Inputs to cells air oxygen water food glucose amino acids fatty acids vitamins minerals ions hormones signals waste carbon dioxide urea heat";
  const line = previewLine(labels, 60);
  assert.ok(line.endsWith("…"));
  assert.ok(labels.startsWith(line.slice(0, -1)));
  assert.ok(!/\s…$/.test(line));
});

test("French notes are read the same way", () => {
  assert.equal(previewLine("Définition\nLa photosynthèse est la production de matière organique par les plantes à partir de la lumière."), "La photosynthèse est la production de matière organique par les plantes à partir de la lumière.");
});
