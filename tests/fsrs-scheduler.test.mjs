import assert from "node:assert/strict";
import test from "node:test";
import { scheduleFromEvidence } from "../domain/fsrs-scheduler.ts";
import { comesBackLine } from "../lib/verdict.ts";

const at = (days, minutes = 0) => new Date(Date.UTC(2026, 10, 20 + days, 12, minutes)).toISOString();
const event = (id, outcome, createdAt, assistance = "none") => ({
  id,
  kind: "retrieval",
  outcome,
  assistance,
  createdAt,
});

test("FSRS uses independent success to place a later review than a missed answer", () => {
  const good = scheduleFromEvidence([event("good", "success", at(0))], at(0));
  const missed = scheduleFromEvidence([event("missed", "failure", at(0))], at(0));
  assert.ok(good && missed);
  assert.ok(Date.parse(good.dueAt) > Date.parse(missed.dueAt));
});

test("FSRS treats a revealed answer as a short relearning step, not independent recall", () => {
  const independent = scheduleFromEvidence([event("independent", "success", at(0))], at(0));
  const revealed = scheduleFromEvidence([event("revealed", "success", at(0), "answer_revealed")], at(0));
  assert.ok(independent && revealed);
  assert.ok(Date.parse(revealed.dueAt) < Date.parse(independent.dueAt));
});

test("FSRS estimate falls as time passes without another check", () => {
  const events = [event("first", "success", at(0)), event("second", "success", at(1))];
  const fresh = scheduleFromEvidence(events, at(1));
  const stale = scheduleFromEvidence(events, at(20));
  assert.ok(fresh && stale);
  assert.ok(fresh.retrievability > stale.retrievability);
});

test("short FSRS learning steps stay legible in the verdict", () => {
  assert.equal(comesBackLine(at(0, 10), at(0)), "Comes back in 10 minutes");
});
