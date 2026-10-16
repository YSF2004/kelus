import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pilotMilestones } from "../lib/pilot.ts";
import { flagKey } from "../lib/flags.ts";

const at = (day, hour = 12) => new Date(2026, 9, 10 + day, hour).toISOString();
const answer = (conceptId, day, kind = "retrieval") => ({ kind, conceptId, createdAt: at(day) });

test("milestones come from answers on different days, and the sample course never counts", () => {
  assert.deepEqual(pilotMilestones({ events: [], sampleConceptIds: new Set() }), []);
  assert.deepEqual(pilotMilestones({ events: [answer("a", 0), answer("a", 0)], sampleConceptIds: new Set() }), ["first_topic"]);
  assert.deepEqual(pilotMilestones({ events: [answer("a", 0), answer("b", 1), answer("a", 4)], sampleConceptIds: new Set() }), ["first_topic", "back_next_day", "back_within_7_days", "studied_3_days"]);
  assert.deepEqual(pilotMilestones({ events: [answer("a", 0), answer("a", 9)], sampleConceptIds: new Set() }), ["first_topic"], "a return after a week is not within 7 days");
  assert.deepEqual(pilotMilestones({ events: [answer("sample", 0), answer("sample", 1)], sampleConceptIds: new Set(["sample"]) }), []);
  assert.deepEqual(pilotMilestones({ events: [answer("a", 0), answer("a", 1, "view")], sampleConceptIds: new Set() }), ["first_topic"], "opening is not studying");
});

test("a flagged question has the same key in every later run, and a different question a different one", () => {
  const q = { prompt: "Fill the gap: “Osmosis moves _____.”", sourceQuote: "Osmosis moves water." };
  assert.equal(flagKey(q), flagKey({ ...q }));
  assert.notEqual(flagKey(q), flagKey({ ...q, prompt: "Which term does this describe?" }));
});

test("the pilot summary turns a GA4 export into students, returns and flags per group", () => {
  const dir = mkdtempSync(join(tmpdir(), "pilot-"));
  const file = join(dir, "export.csv");
  writeFileSync(file, ["# Free form", "Event name,Milestone,Flag reason,Pilot cohort,Total users,Event count",
    "pilot_milestone,first_topic,(not set),bio,10,10", "pilot_milestone,back_within_7_days,(not set),bio,6,6",
    "question_flagged,(not set),wrong_answer,bio,2,3"].join("\n"));
  const out = execFileSync("node", ["scripts/pilot-summary.mjs", file], { encoding: "utf8" });
  assert.match(out, /## bio/);
  assert.match(out, /studied a first topic\s+10/);
  assert.match(out, /within 7 days\s+6\s+\(60%\)/);
  assert.match(out, /The answer is wrong: 3/);
});
