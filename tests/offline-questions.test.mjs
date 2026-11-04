import assert from "node:assert/strict";
import test from "node:test";
import { buildConfirmedMaterialModel, isSourceBackedProposal, proposeConceptsFromPages } from "../domain/material-intelligence.ts";
import { markdownToPages, structurePastedText } from "../domain/markdown-pages.ts";
import { buildQuickRun } from "../domain/quick-run.ts";

const notes = `Photosynthesis
Photosynthesis is the process by which green plants convert light energy into chemical energy stored in glucose. It takes place in the chloroplasts, which contain the green pigment chlorophyll. Carbon dioxide and water are used, and oxygen is released as a by-product.

Cellular respiration
Cellular respiration releases energy from glucose so that cells can do work. Aerobic respiration uses oxygen and produces carbon dioxide and water. Most of the ATP is made in the mitochondria.

Enzymes
Enzymes are biological catalysts that speed up reactions without being used up. Each enzyme has an active site with a specific shape that fits one substrate. High temperatures denature an enzyme because the active site changes shape.`;

function course() {
  const pages = markdownToPages(structurePastedText(notes));
  const proposals = proposeConceptsFromPages({ materialId: "m", sourceLabel: "Biology", pages }).filter(isSourceBackedProposal);
  return buildConfirmedMaterialModel({ proposals, courseId: "c", userId: "u", nowIso: "2026-11-04T12:00:00.000Z", pages });
}

test("finish the line: the right ending is this topic's, every wrong one is a real line from another topic", () => {
  const model = course();
  const enzymes = model.learningActivities[model.concepts.findIndex((concept) => concept.name === "Enzymes")];
  const item = enzymes.practice.find((practice) => practice.variant === "complete");
  assert.ok(item, "the enzymes topic gets a finish-the-line question");
  assert.equal(item.prompt, "Finish the line from your notes: “Each enzyme …”");
  assert.equal(item.choices[item.correctIndex], "… has an active site with a specific shape that fits one substrate");
  const enzymeText = notes.slice(notes.indexOf("Enzymes\n"));
  for (const [index, choice] of item.choices.entries()) {
    if (index === item.correctIndex) continue;
    const ending = choice.replace(/^… /, "");
    assert.ok(notes.includes(ending) && !enzymeText.includes(ending), `"${ending}" is from another topic`);
    // Same verb form as "has": a singular present, never "are used" or "blamed".
    assert.match(ending, /^\S+s\b/);
  }
});

test("a condition or a cut-off clause is never the subject of a line to finish", () => {
  for (const activity of course().learningActivities) {
    for (const item of activity.practice.filter((practice) => practice.variant === "complete")) {
      assert.doesNotMatch(item.prompt, /“(?:If|When|Before|After|In)\b|\b(?:that|which) …”/);
    }
  }
});

test("no gap in half of a term: not “the _____ site” of an enzyme, not “_____ dioxide”", () => {
  const prompts = course().learningActivities.flatMap((activity) => activity.practice.map((item) => item.prompt));
  assert.ok(!prompts.some((prompt) => /_____ site\b/.test(prompt)), "active site is one term");
  assert.ok(!prompts.some((prompt) => /_____ dioxide\b/.test(prompt)), "carbon dioxide is one term");
});

test("a short topic's why question takes its wrong reasons from the rest of the course", () => {
  const model = course();
  const enzymes = model.learningActivities[model.concepts.findIndex((concept) => concept.name === "Enzymes")];
  const why = enzymes.practice.find((item) => item.variant === "why");
  assert.ok(why);
  assert.equal(why.choices[why.correctIndex], "The active site changes shape");
  assert.ok(why.choices.length >= 3);
});

test("a run never asks you to finish the line its explanation will ask for", () => {
  const model = course();
  for (const [index, activity] of model.learningActivities.entries()) {
    for (const round of [0, 1, 2]) {
      const run = buildQuickRun({ activity, name: model.concepts[index].name, siblingNames: model.concepts.map((concept) => concept.name), round, readFirst: round === 0 });
      for (const check of run.checks.filter((item) => item.variant === "complete")) assert.notEqual(check.sourceQuote, run.explainAnswer);
    }
  }
});

test("word options are the same kind of word as the answer: no verb for a thing, no grammar word, names keep their capital", async () => {
  const { gapChoices } = await import("../domain/quick-run.ts");
  const sentences = [
    "Photosynthesis is the process by which green plants convert light energy into chemical energy stored in glucose.",
    "It takes place in the chloroplasts, which contain the green pigment chlorophyll.",
    "Carbon dioxide and water are used, and oxygen is released as a by-product.",
  ];
  const item = { id: "g", kind: "cloze", prompt: "Fill the gap: “Carbon dioxide and water are used, and oxygen is released as a _____.”", modelAnswer: "by-product", hint: "", explanation: "", sourceQuote: sentences[2], origin: "offline" };
  const options = gapChoices(item, { checks: [item], sentences, explainPrompt: "", explainAnswer: sentences[0], explainQuote: sentences[0], topic: "Photosynthesis" });
  assert.ok(options.includes("by-product"));
  assert.ok(!options.includes("contain"), "contain is a verb in these notes");
  assert.ok(!options.includes("that"));

  const history = [
    "The powers competed for colonies in Africa and Asia.",
    "The Moroccan crises of 1905 and 1911 showed that Germany wanted a larger empire and pushed Britain and France closer together.",
  ];
  const africa = { id: "a", kind: "cloze", prompt: "Fill the gap: “The powers competed for colonies in _____ and Asia.”", modelAnswer: "Africa", hint: "", explanation: "", sourceQuote: history[0], origin: "offline" };
  const year = { ...africa, id: "y", prompt: "Fill the gap: “The Moroccan crises of _____ and 1911 …”", modelAnswer: "1905", sourceQuote: history[1] };
  const names = gapChoices(africa, { checks: [africa, year], sentences: history, explainPrompt: "", explainAnswer: "", explainQuote: "", topic: "Imperialism" });
  assert.ok(!names.includes("1905"), "a year never stands in for a place");
  for (const option of names) assert.match(option, /^\p{Lu}/u, `${option} is a name, written as one`);
});
