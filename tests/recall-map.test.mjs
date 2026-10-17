import assert from "node:assert/strict";
import test from "node:test";
import { recallMap } from "../domain/recall-map.ts";

const activity = (conceptId, quotes, explain) => ({
  conceptId,
  practice: quotes.map((sourceQuote, index) => ({ id: `${conceptId}-${index}`, kind: index % 2 ? "cloze" : "choice", sourceQuote })),
  retrieve: { modelAnswer: explain },
});

test("the recall map counts every askable line once, in note order, and where each one stands", () => {
  const concepts = [{ id: "a", name: "Osmosis" }, { id: "b", name: "Enzymes" }];
  const activities = [
    activity("a", ["Water moves across a membrane.", "A cell in a hypotonic solution gains water.", "Water moves across a membrane."], "Osmosis is the movement of water."),
    activity("b", ["Enzymes speed up reactions."], "Enzymes are biological catalysts."),
  ];
  const known = [{ conceptId: "a", name: "Osmosis", quote: "Water moves across a membrane.", at: "2026-10-16T09:00:00Z" }, { conceptId: "a", name: "Osmosis", quote: "An old line no question uses now.", at: "2026-10-01T09:00:00Z" }];
  const missed = [{ conceptId: "a", name: "Osmosis", quote: "A cell in a hypotonic solution gains water.", at: "2026-10-16T09:00:00Z" }];
  const map = recallMap({ concepts, activities, known, missed, nowIso: "2026-10-16T12:00:00Z" });
  assert.deepEqual(map.topics.map((topic) => topic.name), ["Osmosis", "Enzymes"]);
  assert.equal(map.total, 6, "a repeated quote is one line; an old recalled line still counts");
  assert.equal(map.recalled, 2);
  assert.equal(map.back, 1);
  assert.equal(map.thisWeek, 1);
  assert.deepEqual(map.topics[0].lines.map((line) => line.state), ["recalled", "back", "new", "recalled"]);
});
