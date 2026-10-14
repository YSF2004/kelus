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

test("a sparse page of headings still knows its title: body size is counted by letters, not lines", () => {
  const line = (text, fontSize, y) => ({ text, fontSize, x: 72, y, width: text.length * fontSize * 0.5, height: fontSize });
  const blocks = [
    line("Cell Biology - Lecture Notes", 21, 720),
    line("Cell Membranes", 18, 665), line("Cell membranes regulate transport between the cell and its environment.", 11, 635),
    line("Osmosis", 18, 580), line("Osmosis depends on cell membranes and moves water across a selectively permeable membrane.", 11, 550),
    line("Diffusion", 18, 495), line("Diffusion moves particles down a concentration gradient without using cellular energy.", 11, 465),
  ];
  const pages = [{ pageNumber: 1, text: blocks.map((block) => block.text).join("\n\n"), blocks }];
  assert.equal(documentTitle(pages), "Cell Biology - Lecture Notes");
  const names = proposeConceptsFromPages({ materialId: "m", sourceLabel: "s", pages }).filter(isSourceBackedProposal).map((item) => item.name);
  assert.deepEqual(names, ["Cell Membranes", "Osmosis", "Diffusion"]);
});

// Found on real course files (MIT OpenCourseWare lecture slides and handouts), reproduced here with synthetic text.
test("real-PDF quirks: fake-bold doubles, slide bullet glyphs and lost fi/fl ligatures are cleaned", () => {
  const item = (str, x, y, size = 11) => ({ str, transform: [size, 0, 0, size, x, y], width: str.length * size * 0.5, height: size });
  const page = buildLayoutPage(1, [
    item("Effect of Structure on pK", 72, 700, 18), item("Effect of Structure on pK", 72.4, 700, 18),
    item("´", 60, 660), item("Each frm is a price-taker; the defnition of a defect stays as written.", 72, 660),
  ]);
  assert.match(page.text, /^Effect of Structure on pK\n/);
  assert.doesNotMatch(page.text, /pKEffect/);
  assert.match(page.text, /Each firm is a price-taker; the definition of a defect stays as written\./);
  assert.doesNotMatch(page.text, /´/);
});

test("real-PDF quirks: credit-only passages, course admin headings and shared slide passages are not topics", () => {
  const pages = [{ pageNumber: 1, text: [
    "Outline", "Minimum wages and the competitive model of the labour market.",
    "Nominal value of the minimum wage", "Image is in the public\ndomain.",
    "Monopsony", "A monopsonist faces an upward-sloping labour supply curve, so hiring one more worker raises the wage paid to all.",
    "Monopsony power", "A monopsonist faces an upward-sloping labour supply curve, so hiring one more worker raises the wage paid to all.",
  ].join("\n\n") }];
  const names = proposeConceptsFromPages({ materialId: "m", sourceLabel: "s", pages }).filter(isSourceBackedProposal).map((item) => item.name);
  assert.deepEqual(names, ["Monopsony"]);
});

// Found on real LaTeX slides (MIT 14.03) and PowerPoint exports, reproduced with synthetic items.
test("LaTeX maths: a symbol font's p q ´ ą read as ( ) − >, and a formula drawn after its sentence lands inside it", () => {
  const it = (str, x, y, fontName, size = 11) => ({ str, transform: [size, 0, 0, size, x, y], width: str.length * size * 0.5, height: size, fontName });
  const page = buildLayoutPage(1, [
    it("Demand function D", 72, 600, "text"), it(": quantity consumed at price p.", 200, 600, "text"),
    it("Why is", 72, 560, "text"), it("? It pays.", 160, 560, "text"),
    it("p", 170, 600, "sym"), it("p", 178, 600, "math"), it("q", 186, 600, "sym"), it("´", 400, 400, "sym"),
    it("w", 110, 560, "math"), it("ą", 118, 560, "sym"), it("0", 126, 560, "text"),
  ]);
  assert.match(page.text, /Demand function D\s?\(\s?p\s?\)\s?: quantity consumed at price p\./);
  assert.match(page.text, /Why is w\s?>\s?0\s?\? It pays\./);
});

test("PowerPoint exports: Wingdings bullets read as letters are dropped, and the footer on every slide is removed", async () => {
  const { stripRunningLines } = await import("../lib/pdf-extraction.ts");
  const it = (str, x, y, fontName = "body", size = 14) => ({ str, transform: [size, 0, 0, size, x, y], width: str.length * size * 0.5, height: size, fontName });
  const slide = (n, title, line) => buildLayoutPage(n, [
    it(title, 72, 700, "body", 28), it("X", 60, 650, "wing"), it(line, 80, 650), it("u", 60, 620, "wing"), it("A second point on the slide.", 80, 620),
    it("Mansfield University", 72, 60, "foot", 9), it(`Slide ${n}`, 400, 60, "foot", 9),
  ]);
  const pages = stripRunningLines([slide(1, "Structuralism", "Wundt studied conscious experience."), slide(2, "Functionalism", "James asked what the mind is for."), slide(3, "Behaviorism", "Watson studied observable behaviour.")]);
  assert.doesNotMatch(pages.map((page) => page.text).join("\n"), /^X |\nu |Mansfield University|Slide \d/m);
  assert.match(pages[0].text, /Wundt studied conscious experience\./);
});

test("headings that continue an earlier line are not topics: 'And assessing tradeoffs', '…be legal?)'", () => {
  const pages = [{ pageNumber: 1, text: "Opportunity Cost\n\nEvery choice gives something up, the value of the best alternative not chosen.\n\nAnd Assessing Tradeoffs\n\nWeighing what is gained against what is given up in each decision.\n\nShould Organ Sales Be Legal?)\n\nA normative question about markets, values and what should be allowed." }];
  const names = proposeConceptsFromPages({ materialId: "m", sourceLabel: "s", pages }).map((item) => item.name);
  assert.ok(names.includes("Opportunity Cost"));
  assert.ok(!names.some((name) => /^And |\)$/.test(name)), names.join(" / "));
});
