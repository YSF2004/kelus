import assert from "node:assert/strict";
import test from "node:test";
import { buildExamIcs, googleExamUrl } from "../lib/study-reminder.ts";

test("the exam goes in the calendar as an all-day event with alerts a week and a day before", () => {
  const ics = buildExamIcs({ courseName: "Cell Biology", examDate: "2026-12-31", nowMs: Date.UTC(2026, 10, 3) });
  assert.match(ics, /DTSTART;VALUE=DATE:20261231/);
  assert.match(ics, /DTEND;VALUE=DATE:20270101/, "an all-day event ends the next day, across the year end");
  assert.match(ics, /SUMMARY:Exam: Cell Biology/);
  assert.match(ics, /TRIGGER:-P7D/);
  assert.match(ics, /TRIGGER:-P1D/);
  assert.match(ics, /UID:kelus-exam-cell-biology@kelus\.me/, "one event per course, so a changed date moves it");
  assert.equal(buildExamIcs({ courseName: "x", examDate: "next week" }), null);
});

test("calendar text escapes commas and semicolons, as iCalendar needs", () => {
  const ics = buildExamIcs({ courseName: "Law\; Contracts, Part 2", examDate: "2026-12-01" });
  assert.match(ics, /SUMMARY:Exam: Law\\; Contracts\\, Part 2/);
});

test("Google Calendar opens its own add-event page, filled in, for the student to confirm", () => {
  const url = new URL(googleExamUrl({ courseName: "Cell Biology", examDate: "2026-12-31" }));
  assert.equal(url.hostname, "calendar.google.com");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("text"), "Exam: Cell Biology");
  assert.equal(url.searchParams.get("dates"), "20261231/20270101");
});
