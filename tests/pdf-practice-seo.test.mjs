import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the PDF practice entry page has unique crawlable metadata and a real study action", () => {
  const page = readFileSync("app/pdf-to-practice-questions/page.tsx", "utf8");
  const sitemap = readFileSync("app/sitemap.ts", "utf8");
  const footer = readFileSync("components/SiteFooter.tsx", "utf8");

  assert.match(page, /Turn Lecture PDFs into Practice Questions/);
  assert.match(page, /canonical: "\/pdf-to-practice-questions"/);
  assert.match(page, /<h1 id="page-title">/);
  assert.match(page, /href="\/today"/);
  assert.match(page, /Your own questions come from your material/);
  // Question-writing is on the device on kelus.me; the page says so plainly and links to how questions are written.
  assert.match(page, /Your notes stay on this device unless you choose to sync them/);
  assert.match(page, /href="\/privacy#ai-questions"/);
  assert.match(page, /multi-column pages, image-heavy slides and scanned handwriting/);
  assert.match(sitemap, /pdf-to-practice-questions\//);
  assert.match(footer, /href: "\/pdf-to-practice-questions"/);
});
