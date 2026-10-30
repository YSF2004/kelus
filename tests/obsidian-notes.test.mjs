import assert from "node:assert/strict";
import test from "node:test";
import { markdownToPages, plainInline } from "../domain/markdown-pages.ts";
import { buildConfirmedMaterialModel, isSourceBackedProposal, proposeConceptsFromPages } from "../domain/material-intelligence.ts";
import { notesFromTexts, sourceOfPaths } from "../domain/notion-zip.ts";
import { brandForFile } from "../components/BrandIcon.tsx";

// An Obsidian note as students write them: properties, links to other notes, an embed, a callout, a tag, a comment,
// a block id, and one line they highlighted because it is the one that matters.
const NOTE = `---
tags: [biology, exam]
---
# Osmosis

![[cell-diagram.png]]
Osmosis is a special case of [[Diffusion#Passive transport|diffusion]] across a membrane. #biology
Water molecules move through channels called aquaporins in many cells. %%check this in the lecture%%
==Osmosis is the net movement of water from a dilute solution to a more concentrated solution.== ^def-osmosis

> [!note] Tonicity
> A plant cell in a hypotonic solution gains water and becomes turgid, because the cell wall resists it.

# Active transport

Active transport moves ions against their concentration gradient, using energy from respiration.
Carrier proteins in the membrane bind the ion and change shape to move it across. See [[Membranes]].
Root hair cells take in mineral ions from the soil this way, where their concentration is lower than inside.
`;

test("Obsidian syntax reads as plain words: links, embeds, highlights, tags, comments, block ids and callouts", () => {
  assert.equal(plainInline("A case of [[Diffusion#Passive transport|diffusion]] and [[Membranes#Channels]] #biology"), "A case of diffusion and Membranes");
  assert.equal(plainInline("![[cell-diagram.png]]See [[#Tonicity]] ^abc-1"), "See Tonicity");
  assert.equal(plainInline("==Water moves== to the concentrated side, not C# or #1"), "Water moves to the concentrated side, not C# or #1");
  const [osmosis] = markdownToPages(NOTE);
  assert.doesNotMatch(osmosis.text, /\[\[|\]\]|==|%%|\^def|#biology|\[!note\]|cell-diagram|tags:/);
  assert.match(osmosis.text, /Tonicity\nA plant cell in a hypotonic solution/);
  assert.deepEqual(osmosis.highlights, ["Osmosis is the net movement of water from a dilute solution to a more concentrated solution."]);
});

function osmosisActivity(note) {
  const pages = markdownToPages(note);
  const proposals = proposeConceptsFromPages({ materialId: "m", sourceLabel: "Biology.md", pages, locatorLabel: "Section" }).filter(isSourceBackedProposal);
  const model = buildConfirmedMaterialModel({ proposals, courseId: "c", userId: "u", nowIso: new Date().toISOString(), pages });
  const concept = model.concepts.find((item) => item.name === "Osmosis");
  return { proposals, activity: model.learningActivities.find((item) => item.conceptId === concept?.id) };
}

test("a highlighted line is the one Kelus asks about first, and the answer it compares against", () => {
  const highlighted = /^Osmosis is the net movement of water from a dilute solution/;
  const marked = osmosisActivity(NOTE);
  const plain = osmosisActivity(NOTE.replace(/==/g, ""));
  const firstOf = (activity, kind) => activity?.practice?.find((item) => item.kind === kind)?.sourceQuote ?? "";
  assert.deepEqual(marked.proposals.find((proposal) => proposal.name === "Osmosis")?.highlights, ["Osmosis is the net movement of water from a dilute solution to a more concentrated solution."]);
  // With the highlight: the first gap-fill, the explain-it question and the model answer are the student's line.
  assert.match(firstOf(marked.activity, "cloze"), highlighted);
  assert.match(firstOf(marked.activity, "recall"), highlighted);
  assert.match(marked.activity?.retrieve?.modelAnswer ?? "", highlighted);
  // Without it, the page's own first line leads, as before.
  assert.doesNotMatch(firstOf(plain.activity, "cloze"), highlighted);
  assert.doesNotMatch(plain.activity?.retrieve?.modelAnswer ?? "", highlighted);
  // A topic without highlights carries none.
  assert.equal(marked.proposals.find((proposal) => proposal.name === "Active transport")?.highlights, undefined);
});

test("a vault is told apart from a Notion export, and its notes are labelled with Obsidian's mark", () => {
  assert.equal(sourceOfPaths(["Biology/Osmosis.md", ".obsidian/app.json"]), "obsidian");
  assert.equal(sourceOfPaths(["Biology 0123456789abcdef0123456789abcdef.md"]), "notion");
  const notes = notesFromTexts([{ path: "Biology/Osmosis.md", text: NOTE }, { path: ".obsidian/workspace.md", text: "# Layout\n\n" + "x ".repeat(80) }], "obsidian");
  assert.equal(notes.source, "obsidian");
  assert.equal(notes.pages, 1, "settings inside .obsidian are not notes");
  assert.equal(brandForFile("Biology.md", "text/markdown;variant=obsidian"), "obsidian");
  assert.equal(brandForFile("Biology.md", "text/markdown;variant=notion"), "notion");
});
