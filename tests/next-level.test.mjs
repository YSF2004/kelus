import assert from "node:assert/strict";
import test from "node:test";
import { nudgeText } from "../lib/nudge.ts";
import { guessLanguage } from "../lib/speak.ts";
import { linesAround } from "../domain/quick-run.ts";

test("the nudge names the topics waiting, most lines first", () => {
  assert.equal(nudgeText(["Osmosis"]).title, "One line from Osmosis is ready to come back");
  assert.equal(nudgeText(["Osmosis", "Osmosis", "Diffusion"]).title, "3 lines from Osmosis and Diffusion are ready to come back");
  assert.equal(nudgeText(["A", "B", "B", "C"]).title, "4 lines from B and 2 more topics are ready to come back");
  assert.equal(nudgeText(["", ""]).title, "2 lines are ready to come back");
  assert.match(nudgeText(["Osmosis"]).body, /about a minute, before anything new/);
});

test("a French line is read by a French voice", () => {
  assert.equal(guessLanguage("La photosynthèse est la réaction par laquelle les plantes fabriquent du glucose."), "fr");
  assert.equal(guessLanguage("Osmosis is the movement of water across a membrane."), "en");
});

test("a missed line comes with the line before and after it in the notes", () => {
  const run = { checks: [], explainPrompt: "", explainAnswer: "", explainQuote: "", topic: "Osmosis", sentences: ["First line of the notes here.", "The line that was asked about.", "The line that follows it."] };
  assert.deepEqual(linesAround(run, "The line that was asked about."), { before: "First line of the notes here.", line: "The line that was asked about.", after: "The line that follows it." });
  assert.equal(linesAround({ ...run, sentences: ["Only one line here."] }, "Only one line here."), null);
  assert.equal(linesAround(run, "Not in the notes at all."), null);
});
