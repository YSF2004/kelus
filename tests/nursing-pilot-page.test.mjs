import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("the nursing pilot is source-grounded, opt-in, and does not claim exam alignment", () => {
  const page = readFileSync("app/nursing-notes-to-practice-questions/page.tsx", "utf8");
  assert.match(page, /landing="nursing-pilot"/);
  assert.match(page, /pilot="nursing-pilot"/);
  assert.match(page, /does not claim NCLEX alignment/);
  assert.match(page, /reject a wrong match/);
  assert.match(page, /not affiliated with NCSBN/);
});

test("the nursing pilot appears in discovery and in the public sitemap", () => {
  assert.match(readFileSync("lib/search-pages.ts", "utf8"), /nursing-notes-to-practice-questions/);
  assert.match(readFileSync("app/sitemap.ts", "utf8"), /nursing-notes-to-practice-questions/);
});

test("a pilot link retains ordinary acquisition attribution and adds only its group label", () => {
  const source = readFileSync("components/seo/SearchStartLink.tsx", "utf8");
  assert.match(source, /source=\$\{encodeURIComponent\(landing\)\}/);
  assert.match(source, /pilot=\$\{encodeURIComponent\(pilot\)\}/);
});
