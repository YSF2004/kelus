import assert from "node:assert/strict";
import test from "node:test";
import { daysUntilExam } from "../domain/scheduler.ts";

// The exam is stored at noon UTC on the chosen day (lib/demo-store.ts setExamDate).
const exam = { examDate: "2026-12-12T12:00:00.000Z" };

test("days to the exam are calendar days, the same in the morning and at night", () => {
  assert.equal(daysUntilExam(exam, new Date(2026, 10, 22, 8, 0).toISOString()), 20);
  assert.equal(daysUntilExam(exam, new Date(2026, 10, 22, 23, 50).toISOString()), 20);
  assert.equal(daysUntilExam(exam, new Date(2026, 11, 11, 9, 0).toISOString()), 1);
  assert.equal(daysUntilExam(exam, new Date(2026, 11, 12, 9, 0).toISOString()), 0, "exam day itself");
  assert.equal(daysUntilExam(exam, new Date(2026, 11, 20).toISOString()), 0, "never negative");
});
