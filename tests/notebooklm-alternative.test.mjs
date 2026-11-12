import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the NotebookLM page is crawlable, fair and dated, and shows a real Kelus question", () => {
  const page = readFileSync("app/notebooklm-alternative/page.tsx", "utf8");
  assert.match(page, /canonical: "\/notebooklm-alternative\/"/);
  assert.match(page, /title: "Kelus vs NotebookLM for Exam Revision \| Kelus"/);
  // Claims about another product are dated, say where to check, and say when NotebookLM is the better choice.
  assert.match(page, /as listed in November 2026/);
  assert.match(page, /NotebookLM is the better choice when/);
  assert.match(page, /not affiliated with Google/);
  // It credits NotebookLM's own flashcards and quizzes rather than pretending they do not exist.
  assert.match(page, /Flashcards and quizzes written by Google’s AI/);
  // The example is a question Kelus really wrote: its stem and right ending are in the fixture lecture's text.
  assert.match(page, /measures how quantity demanded responds to a change in consumer income/);
  assert.match(readFileSync("app/sitemap.ts", "utf8"), /notebooklm-alternative\//);
});
