import assert from "node:assert/strict";
import test from "node:test";
import { recallSeries } from "../domain/recall-series.ts";

const a = "Demand falls as price rises.";
const b = "Supply rises as price rises.";
const c = "Elasticity measures response.";
const at = (day, hour = 10) => new Date(2026, 10, day, hour).toISOString();

test("each day counts the lines whose latest answer was right, and a miss takes one off", () => {
  const series = recallSeries({
    lines: [a, b, c],
    history: [
      { quote: a, at: at(1), right: true }, { quote: b, at: at(1), right: false },
      { quote: b, at: at(2), right: true },
      { quote: a, at: at(4), right: false },
    ],
    known: [{ conceptId: "x", name: "x", quote: b, at: at(2) }],
    nowIso: at(4, 18),
  });
  assert.deepEqual(series.map((point) => point.recalled), [1, 2, 2, 1]);
  assert.equal(series.length, 4, "every day from the first answer to today, quiet days included");
});

test("answers from before the history was kept still count, from their last recall, and today matches the lines recalled now", () => {
  const series = recallSeries({ lines: [a, b], history: [], known: [{ conceptId: "x", name: "x", quote: a, at: at(2) }, { conceptId: "x", name: "x", quote: b, at: at(3) }], nowIso: at(3, 20) });
  assert.deepEqual(series.map((point) => point.recalled), [1, 2]);
});

test("lines of another course do not count, and no answers means no line to draw", () => {
  assert.deepEqual(recallSeries({ lines: [a], history: [{ quote: "Other course line.", at: at(1), right: true }], known: [], nowIso: at(2) }), []);
});
