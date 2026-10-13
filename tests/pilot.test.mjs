import assert from "node:assert/strict";
import test from "node:test";
import { cleanCohort, returnVisit, sessionContext } from "../lib/pilot.ts";

const s = (id, startedAt, status = "complete", courseId = "course-own") => ({ id, courseId, startedAt, endedAt: startedAt, status });

test("each session is numbered from the learner's own finished blocks, and the sample never counts", () => {
  const sessions = [s("b", "2026-10-08T09:00:00"), s("a", "2026-10-06T09:00:00"), s("x", "2026-10-05T09:00:00", "complete", "course-microeconomics"), s("c", "2026-10-09T09:00:00", "abandoned")];
  assert.deepEqual(sessionContext({ sessions, sessionId: "b", nowIso: "2026-10-08T10:00:00" }), { session_number: 2, days_since_first: 2 });
  assert.deepEqual(sessionContext({ sessions, nowIso: "2026-10-09T10:00:00" }), { session_number: 3, days_since_first: 3 }, "a block just starting is the next number");
  assert.deepEqual(sessionContext({ sessions: [], nowIso: "2026-10-09T10:00:00" }), { session_number: 1, days_since_first: 0 });
});

test("a return is a later day than a finished block, with the day counted from the first", () => {
  const sessions = [s("a", "2026-10-06T09:00:00"), s("b", "2026-10-08T09:00:00")];
  assert.deepEqual(returnVisit({ sessions, nowIso: "2026-10-11T18:00:00" }), { day: 5, days_since_last: 3, session_count: 2 });
  assert.equal(returnVisit({ sessions, nowIso: "2026-10-08T20:00:00" }), null, "the same day is not a return");
  assert.equal(returnVisit({ sessions: [s("a", "2026-10-06T09:00:00", "abandoned")], nowIso: "2026-10-11T18:00:00" }), null, "no finished block, nothing to return to");
  assert.equal(returnVisit({ sessions: [s("x", "2026-10-06T09:00:00", "complete", "course-microeconomics")], nowIso: "2026-10-11T18:00:00" }), null, "the sample is not a pilot signal");
});

test("a pilot group name from a link is plain and short, or ignored", () => {
  assert.equal(cleanCohort("Lycee-2B"), "lycee-2b");
  assert.equal(cleanCohort("a b"), null);
  assert.equal(cleanCohort("<script>"), null);
  assert.equal(cleanCohort("x".repeat(33)), null);
  assert.equal(cleanCohort(null), null);
});

test("a class invite is kelus.me with a class code, never the notes, and the code names nobody", async () => {
  const { classCode, inviteLink } = await import("../lib/pilot.ts");
  const store = new Map();
  globalThis.localStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) };
  const code = classCode();
  assert.match(code, /^class-[a-z0-9]{6}$/);
  assert.equal(classCode(), code, "the same class keeps its code");
  assert.equal(inviteLink(code), `https://kelus.me/?pilot=${code}&via=invite`);
  store.set("kelus-pilot-cohort", "lycee-2b");
  assert.equal(classCode(), "lycee-2b", "a pilot group is passed on as it is");
  delete globalThis.localStorage;
});
