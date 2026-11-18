import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the Quizlet alternative page is crawlable, fair and dated, and shows a real Kelus question", () => {
  const page = readFileSync("app/quizlet-alternative/page.tsx", "utf8");
  assert.match(page, /canonical: "\/quizlet-alternative\/"/);
  assert.match(page, /title: "Apps Similar to Quizlet: Study Your Own Notes \| Kelus"/);
  // Claims about another product are dated and say where to check, and the page says when Quizlet is the better choice.
  assert.match(page, /checked in November 2026/);
  assert.match(page, /Quizlet is the better choice when/);
  assert.match(page, /not affiliated with Quizlet/);
  // The example is a real question from an openly licensed manual, credited.
  assert.match(page, /The control group is the group used for a /);
  assert.match(page, /CC BY 4\.0/);
  assert.match(readFileSync("app/sitemap.ts", "utf8"), /quizlet-alternative\//);
});
