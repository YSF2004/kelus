import assert from "node:assert/strict";
import test from "node:test";
import { getSourceIntakeVariant } from "../lib/source-intake-experiment.ts";

test("source intake experiment persists one anonymous assignment", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };

  assert.equal(getSourceIntakeVariant(storage, () => 0.8), "course_story");
  assert.equal(getSourceIntakeVariant(storage, () => 0.1), "course_story");
});

test("source intake experiment falls back to the original copy without storage", () => {
  assert.equal(getSourceIntakeVariant(null, () => 0.8), "reference");
});
