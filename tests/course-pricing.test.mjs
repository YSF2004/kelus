import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("the free plan has a visible and enforced 10-file course limit", async () => {
  const [store, library, pricing, cta] = await Promise.all([
    source("lib/material-store.ts"),
    source("components/MaterialLibrary.tsx"),
    source("app/pricing/page.tsx"),
    source("components/FoundingCta.tsx"),
  ]);

  assert.match(store, /FREE_COURSE_SOURCE_LIMIT = 10/);
  assert.match(store, /existingSources\.length >= FREE_COURSE_SOURCE_LIMIT/);
  assert.match(store, /Remove a file to add another/);
  assert.match(library, /const atFreeSourceLimit = sourceFileCount >= FREE_COURSE_SOURCE_LIMIT/);
  assert.match(library, /disabled=\{busy \|\| atFreeSourceLimit\}/);
  assert.match(library, /Free includes 10 source files per course/);
  assert.match(pricing, /One active course and up to 10 course files/);
  assert.match(pricing, /Planned, not built yet/);
  assert.match(cta, /Free includes one active course and up to 10 source files/);
});
