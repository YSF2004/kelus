import assert from "node:assert/strict";
import test from "node:test";
import { isPdfFile, materialTitle, parseMaterialUrl } from "../domain/materials.ts";
import { buildConfirmedMaterialModel, proposeConceptsFromPages } from "../domain/material-intelligence.ts";
import { enhanceOcrPixels, groupPdfTextItems, materialPageFromOcr, ocrScaleForPage } from "../lib/pdf-extraction.ts";
import { mergeMaterialRecords } from "../lib/material-store.ts";
import { MATERIAL_PAGE_FIXTURES } from "./fixtures/material-pages.ts";

test("material links are classified without inventing source data", () => {
  assert.equal(parseMaterialUrl("https://www.youtube.com/watch?v=abc").kind, "video");
  assert.equal(parseMaterialUrl("https://university.edu/week-3.pdf").kind, "pdf");
  assert.equal(parseMaterialUrl("https://university.edu/reading").kind, "link");
});

test("the material screen keeps PDF primary and reveals links on demand", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../components/MaterialLibrary.tsx", import.meta.url), "utf8"));
  assert.match(source, /Drop a PDF here/);
  assert.match(source, /Add a video or web link instead/);
  assert.match(source, /aria-expanded=\{linkOpen\}/);
  assert.match(source, /\{linkOpen \? \(/);
});

test("material URLs reject incomplete and unsafe protocols", () => {
  assert.throws(() => parseMaterialUrl("youtube.com/watch?v=abc"), /complete link/);
  assert.throws(() => parseMaterialUrl("file:///private/notes.pdf"), /Only http/);
});

test("PDF validation and titles are deterministic", () => {
  assert.equal(isPdfFile({ name: "lecture.PDF", type: "" }), true);
  assert.equal(isPdfFile({ name: "notes.txt", type: "text/plain" }), false);
  assert.equal(materialTitle("", "week_03-elasticity.pdf"), "week 03 elasticity");
  assert.equal(materialTitle(" My lecture ", "fallback.pdf"), "My lecture");
});

test("PDF pages produce reviewable concepts with exact page references", () => {
  const proposals = proposeConceptsFromPages({
    materialId: "material-1",
    sourceLabel: "Lecture 4",
    pages: [
      { pageNumber: 1, text: "Course Syllabus\nInstructor Email\nWeek 1: Supply and Demand\nMarkets coordinate buyers and sellers." },
      { pageNumber: 2, text: "2. Elasticity\nElasticity measures responsiveness to a change in price." },
    ],
  });
  assert.deepEqual(proposals.map((item) => item.name), ["Supply and Demand", "Elasticity"]);
  assert.deepEqual(proposals.map((item) => item.locator), ["Page 1", "Page 2"]);
  assert.match(proposals[1].sourceExcerpt, /responsiveness/);
  assert.equal(proposals[1].headingConfidence, "high");
});

test("layout-aware extraction retains visual line evidence", () => {
  const lines = groupPdfTextItems([
    { str: "Graph", width: 48, height: 18, transform: [18, 0, 0, 18, 72, 700] },
    { str: "traversal", width: 70, height: 18, transform: [18, 0, 0, 18, 124, 700] },
    { str: "Breadth-first search visits neighbors by level.", width: 230, height: 11, transform: [11, 0, 0, 11, 72, 670] },
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].text, "Graph traversal");
  assert.equal(lines[0].fontSize, 18);
  assert.equal(lines[1].fontSize, 11);
});

test("OCR text re-enters the same page-aware concept pipeline", () => {
  const page = materialPageFromOcr(7, "CELLULAR RESPIRATION\nCells transfer energy from glucose into ATP through a sequence of reactions.");
  assert.equal(page.needsOcr, false);
  const proposals = proposeConceptsFromPages({ materialId: "scan-1", sourceLabel: "Scanned lecture", pages: [page] });
  assert.equal(proposals[0].name, "CELLULAR RESPIRATION");
  assert.equal(proposals[0].locator, "Page 7");
});

test("OCR cleanup repairs line-break hyphenation and keeps paragraph boundaries", () => {
  const page = materialPageFromOcr(2, "NEURAL NET-\nworks\n\nModels learn repre-\nsentations from training examples.");
  assert.match(page.text, /NETworks/);
  assert.match(page.text, /representations/);
  assert.ok(page.lines.some((line) => line.paragraphBreakBefore));
});

test("OCR rendering scales small scans up and caps very large scans", () => {
  assert.ok(ocrScaleForPage(612, 792) > 2);
  assert.equal(ocrScaleForPage(2400, 3200), 1.6);
});

test("OCR preprocessing converts uneven color pixels to stretched grayscale", () => {
  const pixels = new Uint8ClampedArray([40, 60, 80, 255, 180, 200, 220, 255]);
  enhanceOcrPixels(pixels);
  assert.equal(pixels[0], pixels[1]);
  assert.equal(pixels[1], pixels[2]);
  assert.ok(pixels[4] > pixels[0]);
});

test("representative course fixtures produce grounded concepts across subjects", () => {
  const expected = {
    biology: ["CELLULAR RESPIRATION", "Electron transport chain"],
    computerScience: ["Hash tables", "Graph traversal"],
    history: ["Industrialization and Urban Life", "Labor Movements"],
    law: ["THE DOCTRINE OF CONSIDERATION", "Promissory Estoppel"],
    mathematics: ["The Extreme Value Theorem"],
  };
  for (const [subject, pages] of Object.entries(MATERIAL_PAGE_FIXTURES)) {
    const proposals = proposeConceptsFromPages({ materialId: `material-${subject}`, sourceLabel: subject, pages });
    assert.deepEqual(proposals.map((item) => item.name), expected[subject], subject);
    assert.ok(proposals.every((item) => item.sourceExcerpt.length > 40), `${subject} needs a useful source paragraph`);
  }
});

test("supporting evidence keeps the complete paragraph instead of one nearby line", () => {
  const [proposal] = proposeConceptsFromPages({
    materialId: "material-cs",
    sourceLabel: "Algorithms",
    pages: MATERIAL_PAGE_FIXTURES.computerScience,
  });
  assert.match(proposal.sourceExcerpt, /converting each key into an array position/);
  assert.match(proposal.sourceExcerpt, /Collisions require a strategy/);
});

test("confirmed material concepts become the existing learning model", () => {
  const proposals = proposeConceptsFromPages({
    materialId: "material-1",
    sourceLabel: "Lecture 4",
    pages: [{ pageNumber: 3, text: "Elasticity\nElasticity measures responsiveness to changes in price.\nMarket Structures\nMarket power distinguishes the structures." }],
  });
  const model = buildConfirmedMaterialModel({ proposals, courseId: "course-1", userId: "user-1", nowIso: "2026-09-05T12:00:00.000Z" });
  assert.equal(model.concepts.length, 2);
  assert.equal(model.prompts.length, 2);
  assert.equal(model.learningActivities.length, 2);
  assert.equal(model.relationships.length, 0, "PDF order must not fabricate prerequisites");
  assert.deepEqual(model.learningActivities[0].sourceReferences, [{ materialId: "material-1", label: "Lecture 4", locator: "Page 3" }]);
  assert.equal(model.concepts[0].examImportanceSource, "estimated");
  assert.equal(model.concepts[0].estimatedMinutesSource, "estimated");
  assert.equal(model.concepts[0].examImportance, 0.5);
  assert.equal(model.concepts[0].subjectDomain, "general");
});

test("learning activities use subject-specific execution patterns", () => {
  for (const [subject, pages] of Object.entries(MATERIAL_PAGE_FIXTURES)) {
    const proposals = proposeConceptsFromPages({ materialId: `material-${subject}`, sourceLabel: subject, pages });
    const model = buildConfirmedMaterialModel({ proposals, courseId: "course-1", userId: "user-1", nowIso: "2026-09-05T12:00:00.000Z" });
    assert.ok(model.concepts.every((concept) => concept.subjectDomain !== "general"), subject);
  }
});

test("only explicit prerequisite language creates a source-evidenced relationship", () => {
  const proposals = proposeConceptsFromPages({
    materialId: "material-graph",
    sourceLabel: "Algorithms",
    pages: [{ pageNumber: 4, text: "Graph Foundations\nGraph foundations define vertices and edges in a network.\n\nShortest Paths\nShortest Paths requires Graph Foundations before comparing route costs." }],
  });
  const model = buildConfirmedMaterialModel({ proposals, courseId: "course-1", userId: "user-1", nowIso: "2026-09-05T12:00:00.000Z" });
  assert.equal(model.relationships.length, 1);
  assert.equal(model.relationships[0].kind, "prerequisite");
  assert.equal(model.relationships[0].evidence.locator, "Page 4");
  assert.equal(model.relationships[0].evidence.basis, "explicit_dependency");
  assert.equal(model.relationships[0].evidence.confidence, "high");
});

test("an implied cross-reference becomes related evidence, not a fabricated prerequisite", () => {
  const proposals = proposeConceptsFromPages({
    materialId: "material-related",
    sourceLabel: "Algorithms",
    pages: [{ pageNumber: 5, text: "Graph Foundations\nGraph Foundations define vertices and edges in a network.\n\nShortest Paths\nShortest Paths use Graph Foundations to represent routes before comparing their costs." }],
  });
  const model = buildConfirmedMaterialModel({ proposals, courseId: "course-1", userId: "user-1", nowIso: "2026-09-05T12:00:00.000Z" });
  assert.equal(model.relationships.length, 1);
  assert.equal(model.relationships[0].kind, "related");
  assert.equal(model.relationships[0].evidence.basis, "source_cross_reference");
  assert.equal(model.relationships[0].evidence.confidence, "medium");
});

test("remote material metadata merges without discarding the local PDF", () => {
  const base = {
    id: "material-1", courseId: "course-1", kind: "pdf", storage: "local", title: "Lecture", sourceUrl: null,
    fileName: "lecture.pdf", mimeType: "application/pdf", sizeBytes: 120, role: "notes", processingStatus: "ready", addedAt: "2026-09-05T12:00:00.000Z",
  };
  const [merged] = mergeMaterialRecords([{ ...base, syncStatus: "local" }], [{ ...base, remotePath: "user/material-1/lecture.pdf", syncStatus: "synced" }]);
  assert.equal(merged.storage, "local");
  assert.equal(merged.remotePath, "user/material-1/lecture.pdf");
  assert.equal(merged.syncStatus, "synced");
});

test("course material migration keeps metadata and files private to auth uid", async () => {
  const sql = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../database/004_course_materials.sql", import.meta.url), "utf8"));
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /storage\.foldername\(name\).*auth\.uid\(\)::text/is);
  assert.match(sql, /public, file_size_limit.*false/is);
  assert.match(sql, /drop policy if exists "course_materials_select_own"/i);
  assert.match(sql, /drop policy if exists "course_material_files_select_own"/i);
});
