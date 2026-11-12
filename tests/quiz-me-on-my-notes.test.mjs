import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the quiz-me page is crawlable and its example is a real, credited Kelus question with its source line", () => {
  const page = readFileSync("app/quiz-me-on-my-notes/page.tsx", "utf8");
  assert.match(page, /canonical: "\/quiz-me-on-my-notes\/"/);
  assert.match(page, /title: "Quiz Me on My Notes: Free Practice Questions \| Kelus"/);
  assert.match(page, /what happens when cells are placed in a hypertonic solution/);
  assert.match(page, /water moves out of the cell into the lower free water solution\./);
  assert.match(page, /CC BY 4\.0/);
  assert.match(readFileSync("app/sitemap.ts", "utf8"), /quiz-me-on-my-notes\//);
});
