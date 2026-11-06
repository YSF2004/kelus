import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveEvidenceSource } from "../domain/source-reference.ts";

const root = new URL("../", import.meta.url);
const lecture = { materialId: "lecture", label: "Lecture notes", locator: "Page 4" };
const slides = { materialId: "slides", label: "Slides", locator: "Page 12" };

test("a question's own source wins over course source order", () => {
  const result = resolveEvidenceSource(slides, [lecture, slides]);
  assert.equal(result.kind, "source");
  assert.equal(result.basis, "question");
  assert.equal(result.reference, slides);
});

test("older data uses a single unambiguous source", () => {
  const result = resolveEvidenceSource(undefined, [lecture]);
  assert.equal(result.kind, "source");
  assert.equal(result.basis, "only-source");
  assert.equal(result.reference, lecture);
});

test("older data with several sources is ambiguous, never assigned the first file", () => {
  const result = resolveEvidenceSource(undefined, [lecture, slides]);
  assert.equal(result.kind, "ambiguous");
  assert.equal(result.reference, null);
  assert.deepEqual(result.options, [lecture, slides]);
});

test("questions without a linked file are reported as missing", () => {
  const result = resolveEvidenceSource(undefined, []);
  assert.equal(result.kind, "missing");
  assert.equal(result.reference, null);
});

test("study feedback offers a verified file choice or an honest missing-source route", async () => {
  const quickRun = await readFile(new URL("components/QuickRun.tsx", root), "utf8");
  const session = await readFile(new URL("app/session/page.tsx", root), "utf8");
  assert.match(quickRun, /This saved question isn’t linked to one file/);
  assert.match(quickRun, /no course file is linked to verify it/);
  assert.match(quickRun, /label=\{w\.seeOnPage\}/);
  assert.match(session, /sourceReferences=\{activity\.sourceReferences\}/);
  assert.match(session, /onShowLine=\{\(quote, reference\) =>/);
  assert.doesNotMatch(session, /materials\.find\(\(item\) => item\.courseId === concept\.courseId && item\.storage === "local"\)/);
});
