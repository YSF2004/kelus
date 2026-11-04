import assert from "node:assert/strict";
import test from "node:test";
import { pptxToMarkdown, slideParagraphs } from "../domain/pptx.ts";
import { slide, storedZip } from "./pptx-fixture.mjs";

test("a deck becomes notes: each titled slide a heading, its text the lines under it, in slide order", async () => {
  const deck = storedZip({
    "[Content_Types].xml": "<Types/>",
    "ppt/slides/slide10.xml": slide("Enzymes", "Enzymes are biological catalysts that speed up reactions"),
    "ppt/slides/slide2.xml": slide("Photosynthesis", ["Plants convert light energy ", "into chemical energy."], "It happens in the chloroplasts &amp; needs light"),
    "ppt/slides/slide3.xml": slide(),
    "ppt/notesSlides/notesSlide2.xml": slide("Speaker notes are not part of the deck"),
  });
  const markdown = await pptxToMarkdown(deck);
  assert.equal(markdown, "# Photosynthesis\n\nPlants convert light energy into chemical energy.\nIt happens in the chloroplasts & needs light.\n\n# Enzymes\n\nEnzymes are biological catalysts that speed up reactions.");
});

test("text runs join into one line, entities decode, and a deck with no text says so", async () => {
  assert.deepEqual(slideParagraphs(slide(["Mito", "chondria"], "ATP &lt; ADP")), ["Mitochondria", "ATP < ADP"]);
  await assert.rejects(pptxToMarkdown(storedZip({ "ppt/slides/slide1.xml": slide() })), /No text was found/);
  await assert.rejects(pptxToMarkdown(storedZip({ "word/document.xml": "<w/>" })), /doesn’t look like a PowerPoint deck/);
});
