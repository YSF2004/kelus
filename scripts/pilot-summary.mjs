#!/usr/bin/env node
/**
 * Summarize one real-course pilot cohort from a GA4 Free form CSV export.
 *
 * Main export rows: Event name, Pilot cohort, Session number, Course type,
 * Helpful, Flag reason, Source type. Values: Total users, Event count.
 * Include session_started, session_completed, session_usefulness_rated,
 * question_flagged, and material_processing_completed. Do not prefilter course_type:
 * retain sample and unclassified rows so validation can detect missing data.
 * Separate returns export: filter event_name=learner_returned, day <= 7,
 * and the same cohort, without a course_type filter; use Pilot cohort and Course type rows.
 * Values: Total users, Event count. Keep one aggregate row per cohort/course type.
 *
 * Invited students are recorded by the pilot organizer, not analytics. Run:
 *   node scripts/pilot-summary.mjs export.csv --returns returns.csv --cohort lycee-2b --invited 18
 * Add --window-complete only after every first-session completer has had seven
 * full days to return. Never enter student names, emails, notes, or answers.
 */
import { readFileSync } from "node:fs";

const [file, ...args] = process.argv.slice(2);
const options = new Map();
for (let index = 0; index < args.length; index += 1) {
  const key = args[index];
  if (key === "--window-complete") {
    options.set(key, true);
    continue;
  }
  if (!key.startsWith("--") || index + 1 >= args.length) {
    console.error(`Unexpected argument: ${key}`);
    process.exit(1);
  }
  options.set(key, args[index + 1]);
  index += 1;
}

const cohort = options.get("--cohort");
const invitedValue = options.get("--invited");
const invited = Number(invitedValue);
const returnsFile = options.get("--returns");
if (!file || !returnsFile || !cohort || !/^[a-z0-9-]{1,32}$/.test(cohort) || !Number.isInteger(invited) || invited < 0) {
  console.error("Usage: node scripts/pilot-summary.mjs <ga4-export.csv> --returns <returns.csv> --cohort <code> --invited <count> [--window-complete]");
  process.exit(1);
}

/** Parse one CSV line, including quoted cells and doubled quotes. */
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

function readTable(path, requiredColumn) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("#"));
  const headerAt = lines.findIndex((line) => new RegExp(requiredColumn, "i").test(line));
  if (headerAt < 0) throw new Error(`No '${requiredColumn}' column found in ${path}.`);
  const header = cells(lines[headerAt]).map((name) => name.toLowerCase());
  return { header, rows: lines.slice(headerAt + 1).map(cells) };
}

let mainTable;
let returnTable;
try {
  mainTable = readTable(file, "event name");
  returnTable = readTable(returnsFile, "pilot cohort");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const header = mainTable.header;
const column = (pattern) => header.findIndex((name) => pattern.test(name));
const at = {
  event: column(/^event name$/),
  cohort: column(/cohort/),
  sessionNumber: column(/session number/),
  courseType: column(/course type/),
  helpful: column(/helpful/),
  reason: column(/flag reason|reason/),
  sourceType: column(/source type/),
  users: column(/^(total )?users$/),
  count: column(/^event count$/),
};
for (const key of ["event", "cohort", "sessionNumber", "courseType", "helpful", "reason", "sourceType", "users", "count"]) {
  if (at[key] < 0) {
    console.error(`The GA4 export is missing the required ${key} column.`);
    process.exit(1);
  }
}

const count = (value) => Number(String(value ?? "").replace(/[^\d.-]/g, "")) || 0;
const totals = {
  starts: 0,
  completions: 0,
  returns: 0,
  helpful: 0,
  notHelpful: 0,
  ratings: 0,
  flags: {},
  sources: {},
  rows: 0,
};

const reportEvents = new Set(["session_started", "session_completed", "session_usefulness_rated", "question_flagged", "material_processing_completed"]);
for (const row of mainTable.rows) {
  const event = row[at.event];
  if (!reportEvents.has(event) || row[at.cohort] !== cohort || row[at.courseType] === "sample") continue;
  if (row[at.courseType] !== "real") {
    console.error(`Missing real/sample course type for ${event}. Register the course_type dimension and collect classified events; historical unclassified events cannot be treated as zero usage.`);
    process.exit(1);
  }
  totals.rows += 1;
  const users = count(row[at.users]);
  const events = count(row[at.count]);
  const realCourse = row[at.courseType] === "real";
  if (event === "session_started" && realCourse && row[at.sessionNumber] === "1") totals.starts += users;
  if (event === "session_completed" && realCourse && row[at.sessionNumber] === "1") totals.completions += users;
  if (event === "session_usefulness_rated") {
    if (!/^(true|false|1|0|yes|no)$/i.test(row[at.helpful])) {
      console.error("Missing Helpful value for a usefulness rating. Register the helpful dimension and re-export; missing ratings are not negative feedback.");
      process.exit(1);
    }
    const helpful = at.helpful >= 0 && /^(true|1|yes)$/i.test(row[at.helpful]);
    if (helpful) totals.helpful += events;
    else totals.notHelpful += events;
    totals.ratings += events;
  }
  if (event === "question_flagged") {
    const reason = at.reason >= 0 && row[at.reason] ? row[at.reason] : "unspecified";
    totals.flags[reason] = (totals.flags[reason] ?? 0) + events;
  }
  if (event === "material_processing_completed" && realCourse && at.sourceType >= 0) {
    const source = row[at.sourceType] || "unspecified";
    totals.sources[source] = (totals.sources[source] ?? 0) + events;
  }
}

const returnHeader = returnTable.header;
const returnCohortAt = returnHeader.findIndex((name) => /cohort/.test(name));
const returnUsersAt = returnHeader.findIndex((name) => /^(total )?users$/.test(name));
const returnCourseTypeAt = returnHeader.findIndex((name) => /course type/.test(name));
if (returnUsersAt < 0 || returnCourseTypeAt < 0) {
  console.error("The 7-day returns export must include Pilot cohort, Course type, and Total users.");
  process.exit(1);
}
const cohortReturnRows = returnTable.rows.filter((row) => row[returnCohortAt] === cohort && row[returnCourseTypeAt] !== "sample");
if (cohortReturnRows.some((row) => row[returnCourseTypeAt] !== "real")) {
  console.error("Missing real/sample course type in the returns export. Do not interpret unclassified returns as zero.");
  process.exit(1);
}
if (cohortReturnRows.length > 1) {
  console.error("The returns export must contain one aggregate row per cohort. Remove daily or other breakdowns; summing Total users can count returning students twice.");
  process.exit(1);
}
totals.returns = count(cohortReturnRows[0]?.[returnUsersAt]);

if (!totals.rows) {
  console.log(`## ${cohort}`);
  console.log(`Invited students: ${invited}`);
  console.log("No matching GA4 events in this export. Check the date range and cohort filter before treating this as zero usage.");
  process.exit(0);
}

const percent = (part, whole) => whole ? `${Math.round((part / whole) * 100)}%` : "not available";
const ratio = (part, whole, denominatorLabel) =>
  `${part} of ${whole} ${denominatorLabel} (${percent(part, whole)}; cohort N=${invited} invited)`;
const flagLabels = {
  unclear: "Doesn't make sense",
  wrong_answer: "The answer is wrong",
  not_in_notes: "Not what my notes say",
  unsupported_explanation: "The explanation isn't supported by my notes",
};

console.log(`## ${cohort}`);
console.log(`Invited students: ${invited}`);
console.log(`First-session starts: ${ratio(totals.starts, invited, "invited students")}`);
console.log(`First-session completions: ${ratio(totals.completions, totals.starts, "first-session starters")}`);
if (options.get("--window-complete")) {
  console.log(`Returned within 7 days: ${ratio(totals.returns, totals.completions, "first-session completers")}`);
} else {
  console.log(`Returned within 7 days: ${totals.returns} students recorded; final rate pending a complete seven-day observation window.`);
}
console.log(`Usefulness ratings: ${totals.helpful} helpful, ${totals.notHelpful} not yet (${totals.ratings} ratings total)`);
console.log(`Rated helpful: ${ratio(totals.helpful, totals.ratings, "usefulness ratings")}`);
const flags = Object.values(totals.flags).reduce((sum, value) => sum + value, 0);
console.log(`Questions flagged: ${flags}`);
for (const [reason, value] of Object.entries(totals.flags).sort((a, b) => b[1] - a[1])) {
  console.log(`  · ${flagLabels[reason] ?? reason}: ${value}`);
}
const sourceEntries = Object.entries(totals.sources).filter(([, value]) => value > 0);
console.log(`Source types tested: ${sourceEntries.length ? sourceEntries.map(([source, value]) => `${source} (${value} processing events)`).join(", ") : "none recorded"}`);
console.log("\nCounts are browser-level GA4 estimates, not verified unique people across devices. These are usage and self-reported usefulness measures, not learning gains.");
