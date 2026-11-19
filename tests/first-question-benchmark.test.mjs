import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildLayoutPage, pageNeedsOcr } from "../lib/pdf-extraction.ts";
import { buildConfirmedMaterialModel, isSourceBackedProposal, proposeConceptsFromPages } from "../domain/material-intelligence.ts";
import { buildQuickRun } from "../domain/quick-run.ts";
import { quoteIsOnPage } from "../domain/content-engine.ts";
import { notesFromZip } from "../domain/notion-zip.ts";
import { markdownToPages } from "../domain/markdown-pages.ts";

const FIXTURES = [
  "econ-lecture-4-elasticity.pdf",
  "biology-ch7-cell-transport.pdf",
  "history-causes-ww1-handout.pdf",
  "fiche-photosynthese.pdf",
];

async function pagesFromPdf(file) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(`tests/fixtures/course-pdfs/${file}`)),
    disableFontFace: true,
    verbosity: 0,
  }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    pages.push(buildLayoutPage(pageNumber, (await (await pdf.getPage(pageNumber)).getTextContent()).items));
  }
  return pages;
}

/** The first real task a new learner sees must be a question that the file itself can prove. */
function assertFirstQuestion(pages, label) {
  const proposals = proposeConceptsFromPages({ materialId: "benchmark-source", sourceLabel: label, pages }).filter(isSourceBackedProposal);
  assert.ok(proposals.length, `${label}: no source-backed topic was found`);
  const model = buildConfirmedMaterialModel({ proposals, courseId: "benchmark-course", userId: "benchmark", nowIso: "2026-11-19T12:00:00.000Z", pages });
  const activity = model.learningActivities[0];
  const run = buildQuickRun({ activity, name: model.concepts[0].name, siblingNames: model.concepts.slice(1).map((concept) => concept.name), readFirst: false });
  assert.ok(run, `${label}: no first question was made`);
  assert.match(run.explainPrompt, /\?$/);
  assert.ok(run.explainAnswer.length > 20, `${label}: answer is too thin`);
  const corpus = pages.map((page) => page.text).join("\n");
  assert.ok(quoteIsOnPage(run.explainAnswer, corpus), `${label}: first answer cannot be found in its source`);
  for (const check of run.checks) assert.ok(quoteIsOnPage(check.sourceQuote, corpus), `${label}: a check is not grounded in the source`);
}

test("first-question acceptance benchmark: four real PDF shapes and a Notion export reach a grounded first task", async () => {
  for (const file of FIXTURES) assertFirstQuestion(await pagesFromPdf(file), file);

  const exported = await notesFromZip(fs.readFileSync("tests/fixtures/notion-export.zip"));
  assertFirstQuestion(markdownToPages(exported.markdown), "Notion export");
});

test("first-question acceptance benchmark: an unreadable scan is stopped honestly before a question is invented", async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync("tests/fixtures/scanned-notes.pdf")), disableFontFace: true, verbosity: 0 }).promise;
  const page = await pdf.getPage(1);
  const extracted = buildLayoutPage(1, (await page.getTextContent()).items);
  assert.ok(pageNeedsOcr(extracted), "a scan with no reliable selectable text must ask for OCR, not generate a question");
  const proposals = proposeConceptsFromPages({ materialId: "scan", sourceLabel: "scanned-notes.pdf", pages: [extracted] }).filter(isSourceBackedProposal);
  assert.equal(proposals.length, 0, "a scan without readable evidence must not become a study topic");
});
