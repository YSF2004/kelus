import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the PDF practice entry page has unique crawlable metadata and a real study action", () => {
  const page = readFileSync("app/pdf-to-practice-questions/page.tsx", "utf8");
  const sitemap = readFileSync("app/sitemap.ts", "utf8");
  const footer = readFileSync("components/SiteFooter.tsx", "utf8");

  assert.match(page, /Make Practice Tests From Your Notes & PDFs/);
  assert.match(page, /canonical: "\/pdf-to-practice-questions"/);
  assert.match(page, /<h1 id="page-title">/);
  assert.match(page, /SearchStartLink action="Add your PDF or notes →" landing="pdf-to-practice-questions"/);
  assert.match(readFileSync("components/seo/SearchStartLink.tsx", "utf8"), /href=\{`\/today\?source=/);
  assert.match(page, /Your own questions come from your material/);
  assert.match(page, /const title = "Make Practice Tests From Your Notes & PDFs \| Kelus"/);
  // Question-writing is on the device on kelus.me; the page says so plainly and links to how questions are written.
  assert.match(page, /Your notes stay on this device unless you choose to sync them/);
  assert.match(page, /href="\/privacy#ai-questions"/);
  assert.match(page, /multi-column pages, image-heavy slides and scanned handwriting/);
  assert.match(sitemap, /pdf-to-practice-questions\//);
  // The footer lists every search page from lib/search-pages.ts.
  assert.match(footer, /SEARCH_PAGES\.map/);
  assert.match(readFileSync("lib/search-pages.ts", "utf8"), /href: "\/pdf-to-practice-questions\/"/);
});

test("every search page is in the sitemap, the footer list and the related links, and IndexNow is pinged after a ship", () => {
  const list = readFileSync("lib/search-pages.ts", "utf8");
  const sitemap = readFileSync("app/sitemap.ts", "utf8");
  for (const href of list.match(/href: "([^"]+)"/g).map((m) => m.slice(7, -1))) assert.match(sitemap, new RegExp(`\\$\\{BASE_URL\\}${href.replace(/\//g, "\\/")}`), href);
  assert.match(readFileSync("components/seo/SearchLanding.tsx", "utf8"), /<RelatedSearchPages \/>/);
  const ship = readFileSync("scripts/ship.sh", "utf8");
  const key = ship.match(/indexnow_key="([0-9a-f]{32})"/)?.[1];
  assert.ok(key, "ship.sh holds the IndexNow key");
  assert.equal(readFileSync(`public/${key}.txt`, "utf8"), key);
});
