import assert from "node:assert/strict";
import test from "node:test";
import { buildLayoutPage } from "../lib/pdf-extraction.ts";
import { units } from "../domain/content-engine.ts";
import { checkpointKey, passed } from "../lib/checkpoints.ts";
import { isSourceBackedProposal, proposeConceptsFromPages } from "../domain/material-intelligence.ts";

const item = (str, x, y, size = 10, font = "body", eol = false) => ({ str, transform: [size, 0, 0, size, x, y], width: str.length * size * 0.5, height: size, fontName: font, hasEOL: eol });

test("a slide bullet drawn in a symbol font starts its own point, so two bullets are never glued together", () => {
  const page = buildLayoutPage(1, [
    item("Structuralism", 100, 700, 18, "body", true),
    item("u", 118, 660, 5, "wing"), item("Basic Science", 123, 660, 10, "body", true),
    item("u", 118, 645, 5, "wing"), item("analyze consciousness into its basic parts (structure)", 123, 645, 10, "body", true),
    item("u", 118, 630, 5, "wing"), item("“Introspection”: careful systematic self-observation", 123, 630, 10, "body", true),
  ]);
  const lines = page.text.split("\n").filter(Boolean);
  assert.ok(lines.includes("• Basic Science"), page.text);
  assert.ok(lines.some((line) => line.startsWith("• “Introspection”")), page.text);
  assert.ok(!/\(structure\) “Introspection”/.test(page.text), "two bullets are not one line");
});

test("a large bullet beside small text does not pull the next lines into its row", () => {
  const page = buildLayoutPage(1, [
    item("•", 450, 140, 17), item("The science that studies behavior and", 461, 143, 10, "body", true),
    item("cognitive processes that underlie behavior", 461, 131, 10, "body", true),
    item("profession that applies the knowledge", 461, 119, 10, "body", true),
  ]);
  assert.match(page.text, /^• The science that studies behavior and/);
  assert.ok(page.text.indexOf("cognitive") > page.text.indexOf("studies behavior and"));
  assert.doesNotMatch(page.text, /Thecognitive|studiesbehavior/);
});

test("a lowercase sub-point joins its parent point instead of standing alone", () => {
  assert.deepEqual(units("• American Openness to Psychology\n• young universities and professors\n• less tradition bound than European Institutions"), [
    "American Openness to Psychology: young universities and professors; less tradition bound than European Institutions",
  ]);
});

test("each slide heading keeps its own points, even when they have no full stops", () => {
  const text = "Structuralism\n\n• Edward Titchener\n\n• Elements (structure) of consciousness\n\nFunctionalism\n\n• William James\n\n• Function or purpose of consciousness\n\nBehaviorism\n\n• Psychology should not study internal states\n\n• Only observable behavior";
  const proposals = proposeConceptsFromPages({ materialId: "m", sourceLabel: "Slides", pages: [{ pageNumber: 2, text }] }).filter(isSourceBackedProposal);
  const of = (name) => proposals.find((p) => p.name === name)?.sourceExcerpt ?? "";
  assert.match(of("Structuralism"), /Elements \(structure\)/);
  assert.doesNotMatch(of("Structuralism"), /Function or purpose/);
  assert.match(of("Functionalism"), /Function or purpose/);
});

test("a checkpoint is the same whatever the order of its topics, and four in five is a pass", () => {
  assert.equal(checkpointKey(["b", "a", "c"]), checkpointKey(["c", "b", "a"]));
  assert.equal(passed({ key: "a", right: 4, total: 5, at: "" }), true);
  assert.equal(passed({ key: "a", right: 3, total: 5, at: "" }), false);
  assert.equal(passed(undefined), false);
});
