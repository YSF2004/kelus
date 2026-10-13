import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildLayoutPage } from "../lib/pdf-extraction.ts";
import { units } from "../domain/content-engine.ts";
import { documentTitle, isSourceBackedProposal, proposeConceptsFromPages } from "../domain/material-intelligence.ts";

// Real course layouts printed by a browser: slides, a numbered textbook chapter, a two-column handout, a French sheet.
async function topicsOf(file) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(`tests/fixtures/course-pdfs/${file}`)), disableFontFace: true, verbosity: 0 }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) pages.push(buildLayoutPage(n, (await (await doc.getPage(n)).getTextContent()).items));
  const proposals = proposeConceptsFromPages({ materialId: "m", sourceLabel: file, pages }).filter(isSourceBackedProposal);
  return { title: documentTitle(pages), names: proposals.map((item) => item.name), proposals, text: pages.map((page) => page.text).join("\n") };
}

test("lecture slides: the title slide names the course and Learning objectives is not a topic", async () => {
  const { title, names, proposals } = await topicsOf("econ-lecture-4-elasticity.pdf");
  assert.equal(title, "Lecture 4: Elasticity");
  assert.deepEqual(names, ["Price elasticity of demand", "Determinants of elasticity", "Income elasticity of demand", "Cross-price elasticity"]);
  assert.equal(proposals[0].locator, "Page 3");
});

test("a numbered textbook chapter: 7.1 Diffusion is Diffusion, and the chapter title is the course", async () => {
  const { title, names, text } = await topicsOf("biology-ch7-cell-transport.pdf");
  assert.equal(title, "Cell Transport");
  assert.deepEqual(names, ["Diffusion", "Osmosis", "Active transport"]);
  assert.doesNotMatch(text, /\b\p{Ll}+- \p{Ll}/u, "words split at a line end are joined back");
});

test("a two-column handout: wrapped lines full of names are not headings, and each excerpt starts its own paragraph", async () => {
  const { names, proposals, text } = await topicsOf("history-causes-ww1-handout.pdf");
  assert.deepEqual(names, ["Militarism", "Alliances", "Imperialism", "Nationalism", "The assassination at Sarajevo"]);
  assert.match(proposals.at(-1).sourceExcerpt, /^On 28 June 1914 Gavrilo Princip shot Archduke\sFranz Ferdinand/);
  assert.match(text, /promised to defend/);
  assert.match(text, /Austria-Hungary/, "a real compound keeps its dash");
  // Narrow columns wrap every few words; each sentence a question is built from is whole.
  for (const proposal of proposals) for (const sentence of units(proposal.sourceExcerpt)) assert.match(sentence, /[.!?]$/, `${proposal.name}: "${sentence}"`);
  assert.ok(units(proposals[2].sourceExcerpt).includes("The powers competed for colonies in Africa and Asia."));
});

test("a French revision sheet is read as text: accented headings, sentence case, no table header", async () => {
  const { title, names } = await topicsOf("fiche-photosynthese.pdf");
  assert.equal(title, "Fiche de révision — La photosynthèse");
  assert.deepEqual(names.slice(0, 3), ["Définition", "Où a-t-elle lieu ?", "Facteurs limitants"]);
  assert.ok(!names.includes("Facteur Effet"));
});
