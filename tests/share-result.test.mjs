import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { shareHeadline, shareText, shareUrl, statsFromQuery, whatsappUrl } from "../lib/share-result.ts";

const stats = { course: "Cell Biology", recalled: 6, missed: 3, topics: 2, courseRecalled: 11, courseTotal: 24, streak: 4 };

test("the shared message says what happened in plain words, with the course the student named", () => {
  assert.equal(shareText(stats), "I recalled 6 of 9 lines from Cell Biology today, and the 3 I missed come back tomorrow (4-day streak). Kelus turns your own notes into questions:");
  assert.equal(shareHeadline(stats), "6 of 9 lines recalled");
});

test("the default course name is never shared, one miss reads as one, and a first day has no streak boast", () => {
  const text = shareText({ ...stats, course: null, missed: 1, recalled: 4, streak: 1 });
  assert.match(text, /from my notes/);
  assert.match(text, /the one I missed comes back tomorrow\./);
  assert.doesNotMatch(text, /streak/);
});

test("a session with only own-words answers still has something true to say", () => {
  assert.equal(shareText({ ...stats, recalled: 0, missed: 0, topics: 1, streak: 1 }), "I practiced 1 topic from Cell Biology today. Kelus turns your own notes into questions:");
});

test("the link opens the result page with its numbers only, tagged so arrivals can be counted", () => {
  const url = new URL(shareUrl(stats));
  assert.equal(url.hostname, "kelus.me");
  assert.equal(url.pathname, "/r/");
  assert.equal(url.searchParams.get("utm_source"), "share");
  assert.doesNotMatch(url.toString(), /Cell|Biology/, "the course name never goes in the link");
  assert.deepEqual(statsFromQuery(url.searchParams), { ...stats, course: null });
  assert.match(decodeURIComponent(whatsappUrl(stats)), /^https:\/\/wa\.me\/\?text=I recalled 6 of 9 lines.*kelus\.me\/r\//);
});

test("a tampered or empty link is not shown as a result", () => {
  assert.equal(statsFromQuery(new URLSearchParams("l=5&m=1&t=1&c=9&of=3&s=1")), null, "more recalled than the course has");
  assert.equal(statsFromQuery(new URLSearchParams("l=-1&m=0&t=1&c=0&of=1&s=0")), null);
  assert.equal(statsFromQuery(new URLSearchParams("l=1.5&m=0&t=1&c=0&of=1&s=0")), null);
  assert.equal(statsFromQuery(new URLSearchParams("")), null);
});

test("nothing from the notes can reach the message: it is built from numbers and the course name only", () => {
  const keys = Object.keys(stats).sort();
  assert.deepEqual(keys, ["course", "courseRecalled", "courseTotal", "missed", "recalled", "streak", "topics"]);
});

test("a day with nothing recalled leads with the lines practiced, never with a zero", async () => {
  const { leadStat, shareHeadline, shareText } = await import("../lib/share-result.ts");
  const day = { course: null, recalled: 0, missed: 2, topics: 1, courseRecalled: 0, courseTotal: 7, streak: 1 };
  assert.deepEqual(leadStat(day), { value: 2, of: null, what: "lines practiced from my notes" });
  assert.equal(shareHeadline(day), "2 lines practiced");
  assert.match(shareText(day), /^I practiced 2 lines from my notes today, and the 2 I missed come back tomorrow\./);
  assert.deepEqual(leadStat({ ...day, recalled: 3, missed: 1 }), { value: 3, of: 4, what: "lines recalled from my notes" });
});

test("a classmate who opens a shared result lands in their own notes flow, with the share source retained", () => {
  const page = readFileSync("app/r/SharedResult.tsx", "utf8");
  assert.match(page, /href="\/today\?source=shared-result"/);
  assert.match(page, /Start with your notes/);
  assert.match(page, /Start with one lecture/);
});
