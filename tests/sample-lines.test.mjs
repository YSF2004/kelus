import assert from "node:assert/strict";
import test from "node:test";
import { createDemoLines, createDemoSnapshot } from "../data/demo-seed.ts";
import { recallMap } from "../domain/recall-map.ts";
import { leitner } from "../domain/leitner.ts";

const nowMs = Date.parse("2026-10-24T10:00:00.000Z");
const nowIso = new Date(nowMs).toISOString();

test("the sample's line map sees the questions its sessions ask, not just one line per topic", () => {
  const snapshot = createDemoSnapshot(nowMs);
  const map = recallMap({ concepts: snapshot.concepts, activities: snapshot.learningActivities, known: [], missed: [], nowIso });
  assert.ok(map.topics.every((topic) => topic.lines.length >= 3), "every sample topic has its asked lines");
});

test("the sample arrives with lines answered as its topic history says, so Progress shows marked notes", () => {
  const snapshot = createDemoSnapshot(nowMs);
  const { known, missed } = createDemoLines(snapshot, nowMs);
  assert.ok(known.length >= 10 && missed.length >= 3, "a real mix of recalled and missed lines");
  const state = leitner({ concepts: snapshot.concepts, activities: snapshot.learningActivities, known, missed, nowIso });
  const byTopic = (id) => state.lines.filter((line) => line.conceptId === id);
  // Supply & Demand is the strongest topic and Elasticity the weakest (Game Theory aside): the shares agree.
  const share = (id) => byTopic(id).filter((line) => line.state === "recalled").length / byTopic(id).length;
  assert.ok(share("c-supply-demand") > share("c-elasticity"));
  // A topic whose last answer was not a pass has a line to come back first.
  assert.ok(byTopic("c-elasticity").some((line) => line.state === "missed"));
  // No line is both recalled and missed, and every one is a line its topic really asks.
  const knownQuotes = new Set(known.map((line) => line.quote));
  assert.ok(missed.every((line) => !knownQuotes.has(line.quote)));
  // Nothing is dated today: the sample's history is in the past, so Study claims no answer from today.
  assert.ok([...known, ...missed].every((line) => line.at.slice(0, 10) !== nowIso.slice(0, 10)));
});
