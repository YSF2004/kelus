import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { jpegsToPdf } from "../domain/photos-to-pdf.ts";

// A phone photo of a printed page (the Cell Transport fixture, rendered to a 1131 x 1600 JPEG).
const photo = { bytes: new Uint8Array(readFileSync("tests/fixtures/photos/cell-transport-page.jpg")), width: 1131, height: 1600 };

test("photos become a PDF with one page per photo, each the photo's own size", async () => {
  const pdf = jpegsToPdf([photo, photo]);
  assert.equal(new TextDecoder().decode(pdf.slice(0, 8)), "%PDF-1.4");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: pdf, verbosity: 0 }).promise;
  assert.equal(doc.numPages, 2);
  const page = await doc.getPage(2);
  const [, , width, height] = page.view;
  assert.deepEqual([width, height], [1131, 1600]);
  const operators = await page.getOperatorList();
  assert.ok(operators.fnArray.includes(pdfjs.OPS.paintImageXObject), "the page draws the photo");
  // A photo has no text layer: the reader sends it to OCR, like a scanned page.
  assert.equal((await page.getTextContent()).items.length, 0);
});

test("no photos is refused", () => {
  assert.throws(() => jpegsToPdf([]), /No photos/);
});

import { confidentOcrBlocks, confidentOcrText } from "../lib/pdf-extraction.ts";
import { isSourceBackedProposal, proposeConceptsFromPages } from "../domain/material-intelligence.ts";

// What the recogniser returns for a photo of the Cell Transport page, reduced: box heights are noisy (the section
// headings come out as tall as the text), a small running header sits on top, and sentences end on short lines.
test("on a photo, headings are found by how they read, not by noisy box heights", () => {
  let y = 0;
  const line = (text, height, confidence = 92) => { y += 30; return { text, confidence, bbox: { x0: 60, y0: y, x1: 60 + text.length * 9, y1: y + height } }; };
  const body = (text) => line(text, 21);
  const data = { text: "", blocks: [{ paragraphs: [{ lines: [
    line("Chapter 7 - Cell Transport", 13),
    line("7 Cell Transport", 36),
    body("Every cell must exchange substances with its surroundings. Oxygen and glucose must enter, and carbon"),
    body("dioxide and urea must leave. This chapter describes the three main ways"), line("substances cross the membrane.", 16),
    body("7.1 Diffusion"),
    body("Diffusion is the net movement of particles from a region of higher concentration to a region of lower"),
    body("concentration, down a concentration gradient. It is a passive process, so it needs no energy."),
    body("Figure 7.1 Oxygen diffuses from the alveolus into the blood because its concentration is higher in the"), line("air.", 16),
    body("7.2 Osmosis"),
    body("Osmosis is the net movement of water molecules from a dilute solution to a more concentrated solution"),
    body("through a partially permeable membrane. In a hypotonic solution a plant cell gains water and becomes"), line("turgid.", 17),
    line("7.3 Active transport", 26),
    body("Active transport moves substances against a concentration gradient, from a lower concentration to a"),
    body("higher concentration. It needs energy from respiration and carrier proteins in the membrane."),
  ] }] }] };
  const pages = [{ pageNumber: 1, text: confidentOcrText(data), blocks: confidentOcrBlocks(data) }];
  const names = proposeConceptsFromPages({ materialId: "m", sourceLabel: "Photos of your notes.pdf", pages }).filter(isSourceBackedProposal).map((item) => item.name);
  assert.deepEqual(names, ["Diffusion", "Osmosis", "Active transport"]);
});

test("without boxes, the recogniser's text still falls back to line-length guesses", () => {
  assert.equal(confidentOcrBlocks({ text: "x", blocks: [{ paragraphs: [{ lines: [{ text: "Osmosis", confidence: 90 }] }] }] }), null);
});
