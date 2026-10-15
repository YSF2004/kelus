import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildLayoutPage, repairLigatures } from "../lib/pdf-extraction.ts";
import { standsAlone } from "../domain/question-lint.ts";
import { buildConfirmedMaterialModel, isSourceBackedProposal, proposeConceptsFromPages, spokenName } from "../domain/material-intelligence.ts";
import { buildQuickRun } from "../domain/quick-run.ts";
import { rankLearningActions } from "../domain/routing-engine.ts";

// What a teacher would cross out on a real course PDF, fixed one by one.

test("letters a PDF font dropped from fi and ff come back, and real words stay", () => {
  assert.equal(repairLigatures("simplifed tools for frms and trade-ofs"), "simplified tools for firms and trade-offs");
  assert.equal(repairLigatures("scientifc fgures, satisfed"), "scientific figures, satisfied");
  for (const word of ["roofs", "proofs", "fed", "fly", "fps", "FBI"]) assert.equal(repairLigatures(word), word);
});

test("only a line that reads on its own can be an option or an answer", () => {
  assert.ok(standsAlone("Diffusion is the net movement of particles down a concentration gradient."));
  for (const line of ["Strong acid Weak acid", "Consider a (product) market with:", "Could total earnings increase? Depends on...", "It measures the willingness of consumers to buy a good.", "I- > Br- > Cl- > F- relative stability of conjugate bases", "B.A., University of Richmond, 1989"]) {
    assert.ok(!standsAlone(line), line);
  }
});

const page = (pageNumber, text) => ({ pageNumber, text });

test("a cut-off heading, a quote, a continued slide and the lecturer's name are not topics", () => {
  const pages = [page(1, [
    "Dr. Francis W. Craig", "Ph.D., University of Tennessee, 1998",
    "Osmosis", "Osmosis is the net movement of water molecules from a dilute solution to a more concentrated solution.",
    "Clinical Psychology- The Role of the", "Clinicians treat irrational fears, anxiety and obsessions in their patients.",
    "“Trick” questions (cont’d)", "Some people dream every night, while others seldom remember their dreams.",
    "Diffusion", "Diffusion is the net movement of particles from a higher concentration to a lower concentration.",
  ].join("\n\n"))];
  const names = proposeConceptsFromPages({ materialId: "m", sourceLabel: "Lecture", pages }).filter(isSourceBackedProposal).map((p) => p.name);
  assert.ok(names.includes("Osmosis") && names.includes("Diffusion"), names.join(" | "));
  assert.ok(!names.some((name) => /Craig|Role of the|cont/.test(name)), names.join(" | "));
});

test("questions keep a slide title as written and ask a question heading as it stands", () => {
  assert.equal(spokenName("Evolution of Psychology: Sigmund Freud", ""), "“Evolution of Psychology: Sigmund Freud”");
  assert.equal(spokenName("Cell Membrane", "The cell membrane controls what enters."), "the cell membrane");
  assert.equal(spokenName("Wilhelm Wundt (1832-1920)", ""), "Wilhelm Wundt (1832-1920)");
});

test("a list topic is explained by its list, and the answer is never a fragment", () => {
  const pages = [page(1, [
    "Determinants of elasticity",
    "Close substitutes make demand more elastic, because buyers can switch easily.\nNecessities such as insulin have inelastic demand.\nDemand becomes more elastic over a longer time period.",
  ].join("\n\n"))];
  const proposals = proposeConceptsFromPages({ materialId: "m", sourceLabel: "Lecture", pages, mode: "relaxed" }).filter(isSourceBackedProposal);
  const model = buildConfirmedMaterialModel({ proposals, courseId: "c", userId: "u", nowIso: "2026-10-15T10:00:00.000Z", pages });
  const run = (name) => {
    const concept = model.concepts.find((c) => c.name === name);
    return buildQuickRun({ activity: model.learningActivities.find((a) => a.conceptId === concept.id), name, siblingNames: model.concepts.map((c) => c.name) });
  };
  const determinants = run("Determinants of elasticity");
  assert.equal(determinants.explainPrompt, "What are the determinants of elasticity, according to your notes?");
  assert.match(determinants.explainAnswer, /substitutes.*insulin.*longer time/);
});

test("on a new course the first topics are met in the order of the notes", () => {
  const concept = (id, importance, attempts = 0) => ({ id, courseId: "c", name: id, examImportance: importance, difficulty: 0.5, estimatedMinutes: 18, mastery: attempts ? 0.3 : 0, confidence: 0, predictedRetention: 0, lastReviewedAt: null, nextReviewAt: null, retrievalAttempts: attempts, successfulRetrievals: 0, failedRetrievals: attempts });
  const exam = { id: "e", courseId: "c", examDate: "2026-12-01T09:00:00.000Z", targetPercent: 80, availableMinutes: 45, isActive: true };
  const ranked = rankLearningActions({ concepts: [concept("first", 0.6), concept("second", 0.9), concept("third", 0.7)], relationships: [], events: [], exam, nowIso: "2026-10-15T10:00:00.000Z" });
  assert.deepEqual(ranked.map((r) => r.concept.id), ["first", "second", "third"]);
});

test("the real course fixtures give no fragment answers and no junk topics", async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  for (const file of fs.readdirSync("tests/fixtures/course-pdfs").filter((f) => f.endsWith(".pdf"))) {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(`tests/fixtures/course-pdfs/${file}`)), disableFontFace: true, verbosity: 0 }).promise;
    const pages = [];
    for (let n = 1; n <= doc.numPages; n += 1) pages.push(buildLayoutPage(n, (await (await doc.getPage(n)).getTextContent()).items));
    const proposals = proposeConceptsFromPages({ materialId: "m", sourceLabel: file, pages }).filter(isSourceBackedProposal);
    const model = buildConfirmedMaterialModel({ proposals, courseId: "c", userId: "u", nowIso: "2026-10-15T10:00:00.000Z", pages });
    for (const concept of model.concepts) {
      const run = buildQuickRun({ activity: model.learningActivities.find((a) => a.conceptId === concept.id), name: concept.name, siblingNames: model.concepts.map((c) => c.name) });
      if (!run) continue;
      assert.doesNotMatch(run.explainPrompt, /\?\?|\b[a-z]\.[A-Z]/, `${file}: ${run.explainPrompt}`);
      for (const check of run.checks) assert.ok(!/^Fill the gap/.test(check.prompt) || !/\?”$/.test(check.prompt), `${file}: ${check.prompt}`);
    }
  }
});
