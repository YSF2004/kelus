import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
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

test("the pilot summary reports starts, completions, returns, usefulness, flags and source types", () => {
  const dir = mkdtempSync(join(tmpdir(), "pilot-"));
  const file = join(dir, "export.csv");
  const returns = join(dir, "returns.csv");
  writeFileSync(file, ["# Free form", "Event name,Pilot cohort,Session number,Course type,Helpful,Flag reason,Source type,Total users,Event count",
    "session_started,bio,1,real,(not set),(not set),(not set),10,10",
    "session_completed,bio,1,real,(not set),(not set),(not set),7,7",
    "session_started,bio,1,sample,(not set),(not set),(not set),5,5",
    "session_usefulness_rated,bio,(not set),sample,true,(not set),(not set),5,5",
    "question_flagged,bio,(not set),sample,(not set),wrong_answer,(not set),5,5",
    "session_usefulness_rated,bio,(not set),real,true,(not set),(not set),4,4",
    "session_usefulness_rated,bio,(not set),real,false,(not set),(not set),2,2",
    "question_flagged,bio,(not set),real,(not set),wrong_answer,(not set),2,3",
    "material_processing_completed,bio,(not set),real,(not set),(not set),pdf,5,5",
    "material_processing_completed,bio,(not set),real,(not set),(not set),notes,4,4"].join("\n"));
  writeFileSync(returns, ["Pilot cohort,Course type,Total users,Event count", "bio,real,4,4", "bio,sample,2,2"].join("\n"));
  const out = execFileSync("node", ["scripts/pilot-summary.mjs", file, "--returns", returns, "--cohort", "bio", "--invited", "12", "--window-complete"], { encoding: "utf8" });
  assert.match(out, /## bio/);
  assert.match(out, /Invited students: 12/);
  assert.match(out, /First-session starts: 10 of 12 invited students \(83%; cohort N=12 invited\)/);
  assert.match(out, /First-session completions: 7 of 10 first-session starters \(70%; cohort N=12 invited\)/);
  assert.match(out, /Returned within 7 days: 4 of 7 first-session completers \(57%; cohort N=12 invited\)/);
  assert.match(out, /Rated helpful: 4 of 6 usefulness ratings \(67%; cohort N=12 invited\)/);
  assert.match(out, /The answer is wrong: 3/);
  assert.match(out, /Source types tested: pdf \(5 processing events\), notes \(4 processing events\)/);
  assert.doesNotMatch(out, /First-session starts: 15/);
});

test("the pilot summary withholds an unfinished seven-day return rate", () => {
  const dir = mkdtempSync(join(tmpdir(), "pilot-"));
  const file = join(dir, "export.csv");
  const returns = join(dir, "returns.csv");
  writeFileSync(file, ["Event name,Pilot cohort,Session number,Course type,Helpful,Flag reason,Source type,Total users,Event count",
    "session_started,bio,1,real,(not set),(not set),(not set),2,2",
    "session_completed,bio,1,real,(not set),(not set),(not set),1,1"].join("\n"));
  writeFileSync(returns, ["Pilot cohort,Course type,Total users,Event count", "bio,real,1,1"].join("\n"));
  const out = execFileSync("node", ["scripts/pilot-summary.mjs", file, "--returns", returns, "--cohort", "bio", "--invited", "3"], { encoding: "utf8" });
  assert.match(out, /Returned within 7 days: 1 students recorded; final rate pending/);
  assert.doesNotMatch(out, /Returned within 7 days: 1 of 1/);
});

test("the pilot summary refuses unclassified feedback and overlapping return counts", () => {
  const cases = [
    {
      row: "session_usefulness_rated,bio,(not set),real,(not set),(not set),(not set),1,1",
      returns: ["bio,real,1,1"],
      error: /missing ratings are not negative feedback/,
    },
    {
      row: "session_started,bio,1,real,(not set),(not set),(not set),2,2\nsession_completed,bio,1,(not set),(not set),(not set),(not set),1,1",
      returns: ["bio,real,1,1"],
      error: /historical unclassified events cannot be treated as zero usage/,
    },
    {
      row: "session_completed,bio,1,real,(not set),(not set),(not set),1,1",
      returns: ["bio,real,1,1", "bio,real,1,1"],
      error: /summing Total users can count returning students twice/,
    },
    {
      row: "session_completed,bio,1,real,(not set),(not set),(not set),2,2",
      returns: ["bio,real,1,1", "bio,(not set),1,1"],
      error: /Do not interpret unclassified returns as zero/,
    },
  ];
  for (const entry of cases) {
    const dir = mkdtempSync(join(tmpdir(), "pilot-"));
    const file = join(dir, "export.csv");
    const returns = join(dir, "returns.csv");
    writeFileSync(file, ["Event name,Pilot cohort,Session number,Course type,Helpful,Flag reason,Source type,Total users,Event count", entry.row].join("\n"));
    writeFileSync(returns, ["Pilot cohort,Course type,Total users,Event count", ...entry.returns].join("\n"));
    const result = spawnSync("node", ["scripts/pilot-summary.mjs", file, "--returns", returns, "--cohort", "bio", "--invited", "3", "--window-complete"], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, entry.error);
    assert.doesNotMatch(result.stdout, /%/);
  }
});
