// Prints every word-choice question a first session and a return visit would show, for the fixture courses.
import fs from "node:fs";
import { buildLayoutPage } from "../../lib/pdf-extraction.ts";
import { buildConfirmedMaterialModel, isSourceBackedProposal, proposeConceptsFromPages } from "../../domain/material-intelligence.ts";
import { buildQuickRun, gapChoices } from "../../domain/quick-run.ts";
import { markdownToPages, structurePastedText } from "../../domain/markdown-pages.ts";
const notes = fs.readFileSync(new URL("./review-notes.txt", import.meta.url), "utf8");
async function pdfPages(file) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(`tests/fixtures/course-pdfs/${file}`)), disableFontFace: true, verbosity: 0 }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) pages.push(buildLayoutPage(n, (await (await doc.getPage(n)).getTextContent()).items));
  return pages;
}
for (const [label, given] of [["review notes", markdownToPages(structurePastedText(notes))], ...["biology-ch7-cell-transport.pdf", "econ-lecture-4-elasticity.pdf", "history-causes-ww1-handout.pdf"].map((f) => [f, null])]) {
  const pages = given ?? await pdfPages(label);
  const proposals = proposeConceptsFromPages({ materialId: "m", sourceLabel: label, pages }).filter(isSourceBackedProposal);
  const model = buildConfirmedMaterialModel({ proposals, courseId: "c", userId: "u", nowIso: "2026-11-04T12:00:00.000Z", pages });
  for (const [i, concept] of model.concepts.entries()) {
    const activity = model.learningActivities[i];
    for (const round of [0, 1, 2]) {
      const run = buildQuickRun({ activity, name: concept.name, siblingNames: model.concepts.map((c) => c.name), round, readFirst: round === 0 });
      for (const item of run?.checks ?? []) {
        const options = item.kind === "cloze" ? gapChoices(item, run) : /^Which word completes/.test(item.prompt) && item.variant !== "direction" ? item.choices : null;
        if (!options?.length) continue;
        const line = item.prompt.replace(/^[^“]*/, "").slice(0, 90);
        console.log(`${concept.name} r${round} [${item.kind}] ${line}\n    ${options.map((o) => (o === item.modelAnswer ? "✓" + o : o)).join(" · ")}`);
      }
    }
  }
}
