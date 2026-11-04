// Prints every offline question for the course fixtures and the first-session checks (round 0, read first).
import fs from "node:fs";
import { buildLayoutPage } from "../../lib/pdf-extraction.ts";
import { buildConfirmedMaterialModel, isSourceBackedProposal, proposeConceptsFromPages } from "../../domain/material-intelligence.ts";
import { buildQuickRun } from "../../domain/quick-run.ts";
import { markdownToPages, structurePastedText } from "../../domain/markdown-pages.ts";
const notes = fs.readFileSync(new URL("./review-notes.txt", import.meta.url), "utf8");
async function pdfPages(file) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(`tests/fixtures/course-pdfs/${file}`)), disableFontFace: true, verbosity: 0 }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) pages.push(buildLayoutPage(n, (await (await doc.getPage(n)).getTextContent()).items));
  return pages;
}
const only = process.argv[2];
const sources = [["review notes", markdownToPages(structurePastedText(notes))], ...["biology-ch7-cell-transport.pdf", "econ-lecture-4-elasticity.pdf", "history-causes-ww1-handout.pdf"].map((f) => [f, null])];
for (const [label, given] of sources) {
  if (only && !label.includes(only)) continue;
  const pages = given ?? await pdfPages(label);
  const proposals = proposeConceptsFromPages({ materialId: "m", sourceLabel: label, pages }).filter(isSourceBackedProposal);
  const model = buildConfirmedMaterialModel({ proposals, courseId: "c", userId: "u", nowIso: "2026-11-04T12:00:00.000Z", pages });
  console.log(`\n#### ${label}`);
  for (const [i, concept] of model.concepts.entries()) {
    const activity = model.learningActivities[i];
    console.log(`\n## ${concept.name}  (${activity.practice?.length ?? 0} items)`);
    for (const item of activity.practice ?? []) console.log(`- [${item.kind}${item.variant ? "/" + item.variant : ""}${item.level === "understand" ? "*" : ""}] ${item.prompt}${item.choices ? "\n    " + item.choices.map((c, k) => (k === item.correctIndex ? "✓ " : "· ") + c).join("\n    ") : "  → " + item.modelAnswer}`);
    for (const round of [0, 1]) {
      const run = buildQuickRun({ activity, name: concept.name, siblingNames: model.concepts.map((c) => c.name), round, readFirst: round === 0 });
      console.log(`  >> session ${round + 1}: ${run?.checks.map((c) => `[${c.variant ?? c.kind}] ${c.prompt.slice(0, 70)}`).join(" | ")}`);
    }
  }
}
