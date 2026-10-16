#!/usr/bin/env node
/**
 * Pilot summary from a GA4 export. No API key: in GA4, Explore → Free form, set
 *   Rows:    Event name, milestone, reason, pilot_cohort   (custom definitions, see docs/pilot.md)
 *   Values:  Total users, Event count
 *   Filter:  Event name matches  pilot_milestone|question_flagged|session_usefulness_rated
 * then Share → Download → CSV, and run:
 *   node scripts/pilot-summary.mjs ~/Downloads/export.csv
 *
 * Every pilot_milestone is sent once per student, so "Total users" per milestone is an exact count of students.
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/pilot-summary.mjs <ga4-export.csv>");
  process.exit(1);
}

/** One CSV line into cells, with quoted cells and doubled quotes. */
function cells(line) {
  const out = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { out.push(cell); cell = ""; }
    else cell += char;
  }
  out.push(cell);
  return out.map((value) => value.trim());
}

const lines = readFileSync(file, "utf8").split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("#"));
const headerAt = lines.findIndex((line) => /event name/i.test(line));
if (headerAt < 0) {
  console.error("No 'Event name' column found. Export the Free form exploration described at the top of this script.");
  process.exit(1);
}
const header = cells(lines[headerAt]).map((name) => name.toLowerCase());
const column = (pattern) => header.findIndex((name) => pattern.test(name));
const at = {
  event: column(/^event name$/),
  milestone: column(/milestone/),
  reason: column(/reason/),
  helpful: column(/helpful/),
  cohort: column(/cohort/),
  users: column(/^(total )?users$/),
  count: column(/^event count$/),
};
const number = (value) => Number(String(value ?? "").replace(/[^\d.-]/g, "")) || 0;

const groups = new Map();
for (const line of lines.slice(headerAt + 1)) {
  const row = cells(line);
  const event = row[at.event];
  if (!event || /^(grand )?total/i.test(event)) continue;
  const cohort = at.cohort >= 0 && row[at.cohort] && row[at.cohort] !== "(not set)" ? row[at.cohort] : "no group";
  const group = groups.get(cohort) ?? { milestones: {}, flags: {}, helpful: { yes: 0, no: 0 } };
  if (event === "pilot_milestone" && at.milestone >= 0) group.milestones[row[at.milestone]] = (group.milestones[row[at.milestone]] ?? 0) + number(row[at.users]);
  if (event === "question_flagged") {
    const reason = at.reason >= 0 ? row[at.reason] : "any";
    group.flags[reason] = (group.flags[reason] ?? 0) + number(at.count >= 0 ? row[at.count] : row[at.users]);
  }
  if (event === "session_usefulness_rated" && at.helpful >= 0) {
    const key = /^(true|1|yes)$/i.test(row[at.helpful]) ? "yes" : "no";
    group.helpful[key] += number(row[at.users]);
  }
  groups.set(cohort, group);
}

const share = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");
const REASON = { unclear: "Doesn't make sense", wrong_answer: "The answer is wrong", not_in_notes: "Not what my notes say" };

for (const [cohort, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  const m = group.milestones;
  const started = m.first_topic ?? 0;
  const flags = Object.values(group.flags).reduce((sum, value) => sum + value, 0);
  console.log(`\n## ${cohort}`);
  console.log(`Students who studied a first topic   ${started}`);
  console.log(`Came back the next day               ${m.back_next_day ?? 0}  (${share(m.back_next_day ?? 0, started)})`);
  console.log(`Came back within 7 days              ${m.back_within_7_days ?? 0}  (${share(m.back_within_7_days ?? 0, started)})`);
  console.log(`Studied on 3 different days          ${m.studied_3_days ?? 0}  (${share(m.studied_3_days ?? 0, started)})`);
  const rated = group.helpful.yes + group.helpful.no;
  if (rated) console.log(`Said a block was helpful             ${group.helpful.yes} of ${rated}  (${share(group.helpful.yes, rated)})`);
  console.log(`Questions flagged                    ${flags}${started ? `  (${(flags / started).toFixed(1)} per student)` : ""}`);
  for (const [reason, count] of Object.entries(group.flags).sort(([, a], [, b]) => b - a)) console.log(`  · ${REASON[reason] ?? reason}: ${count}`);
}
if (!groups.size) console.log("No pilot events in this export yet.");
console.log("\nFlagged questions that students chose to send arrive at hello@kelus.me with the question, the answer and the line.");
