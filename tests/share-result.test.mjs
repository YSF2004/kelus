import assert from "node:assert/strict";
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
  assert.equal(shareText({ ...stats, recalled: 0, missed: 0, topics: 1, streak: 1 }), "I practised 1 topic from Cell Biology today. Kelus turns your own notes into questions:");
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
