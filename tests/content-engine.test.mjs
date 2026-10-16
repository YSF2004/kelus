import assert from "node:assert/strict";
import test from "node:test";


test("gaps test the point of a sentence: a figure, acronym or term, never a verb, and never leak the answer", async () => {
  const { buildPractice } = await import("../domain/content-engine.ts");
  const excerpt = "Cellular respiration is the process by which cells convert glucose and oxygen into ATP. It occurs in three stages: glycolysis, the Krebs cycle and the electron transport chain. Glycolysis takes place in the cytoplasm and splits one glucose molecule into two pyruvate molecules, producing a net gain of 2 ATP. A student who spends an evening studying instead of working a shift for $60 has an opportunity cost of $60. It includes both explicit costs, such as money spent, and implicit costs, such as time.";
  const gaps = buildPractice({ conceptId: "r", name: "Cell respiration", excerpt, locator: "Page 3", siblingNames: [] }).filter((item) => item.kind === "cloze");
  assert.ok(gaps.length >= 2);
  for (const item of gaps) {
    assert.doesNotMatch(item.modelAnswer, /^(includes|studying|occurs|produces)$/i);
    const prompt = item.prompt.replace(/^[^“]*“/, "");
    assert.ok(!new RegExp(`(?<![\\w])${item.modelAnswer}(?![\\w])`, "i").test(prompt), `answer "${item.modelAnswer}" leaks in: ${prompt}`);
  }
  assert.ok(gaps.some((item) => /^(2|60|Krebs|ATP|cytoplasm|money)$/i.test(item.modelAnswer)));
});

test("flipOneWord swaps exactly one safe word, and refuses when a flip could still read as true", async () => {
  const { flipOneWord } = await import("../domain/content-engine.ts");
  assert.equal(flipOneWord("In a hypotonic solution a cell gains water and may burst."), null); // two swappable words (hypotonic, gains)
  assert.equal(flipOneWord("Close substitutes make demand more elastic because buyers can switch."), null); // two swappable words
  assert.equal(flipOneWord("Water moves toward the side with more solute because the solute lowers the water potential there."), "Water moves toward the side with less solute because the solute lowers the water potential there.");
  assert.equal(flipOneWord("Prices do not rise when supply increases a little."), null); // negation
  assert.equal(flipOneWord("Cells use energy to build proteins."), null); // nothing to flip
  assert.equal(flipOneWord("Higher prices reduce the quantity that buyers want."), "Lower prices reduce the quantity that buyers want."); // capital kept
});

test("direction items: the quote is the real sentence, the options are the real word and its opposite, the answer is the real word", async () => {
  const { buildPractice, quoteIsOnPage } = await import("../domain/content-engine.ts");
  const excerpt = "Water moves toward the side with more solute because the solute lowers the water potential there. Higher prices reduce the quantity that buyers want from the market. Plant cells resist bursting because the cell wall pushes back, creating turgor pressure inside the cell.";
  const items = buildPractice({ conceptId: "tf1", name: "Osmosis", excerpt, locator: "Page 2", siblingNames: [] }).filter((item) => item.variant === "direction");
  assert.ok(items.length >= 1);
  for (const item of items) {
    assert.equal(item.choices.length, 2);
    assert.equal(item.choices[item.correctIndex], item.modelAnswer);
    assert.ok(quoteIsOnPage(item.sourceQuote, excerpt));
    assert.ok(item.sourceQuote.toLowerCase().includes(item.modelAnswer.toLowerCase()));
    assert.ok(!item.prompt.includes(item.modelAnswer + " ") || item.prompt.includes("_____"));
  }
});

test("a figure caption is asked as its fact, without the figure number", async () => {
  const { units } = await import("../domain/content-engine.ts");
  const lines = units("Figure 7.1 Oxygen diffuses from the alveolus into the blood because its concentration is higher in the air.\nTable 2: Enzymes are proteins that speed up reactions in the cell.");
  assert.ok(lines.some((line) => line.startsWith("Oxygen diffuses from the alveolus")));
  assert.ok(lines.some((line) => line.startsWith("Enzymes are proteins")));
  assert.ok(!lines.some((line) => /^(Figure|Table)\b/.test(line)));
});

test("French notes are asked about in French, with gaps on their ideas, not on accents or small words", async () => {
  const { buildPractice } = await import("../domain/content-engine.ts");
  const { noteLanguage, frenchRecallQuestion, inNotesLanguage } = await import("../domain/note-language.ts");
  const excerpt = "La photosynthèse est la réaction par laquelle les plantes vertes fabriquent du glucose à partir du dioxyde de carbone et de l'eau, en utilisant l'énergie lumineuse captée par la chlorophylle. Les stomates laissent entrer le dioxyde de carbone, et les racines absorbent l'eau du sol.";
  assert.equal(noteLanguage(excerpt), "fr");
  assert.equal(noteLanguage("Osmosis is the movement of water across a membrane."), "en");
  const items = buildPractice({ conceptId: "p", name: "Photosynthèse", excerpt, locator: "Page 1", siblingNames: ["Respiration", "Facteurs limitants", "Équation bilan"] });
  assert.ok(items.length >= 2);
  for (const item of items) assert.doesNotMatch(item.prompt, /\b(?:Which|What|Fill the gap|your notes)\b/, item.prompt);
  const gaps = items.filter((item) => item.kind === "cloze");
  assert.ok(gaps.length >= 1);
  for (const gap of gaps) {
    assert.match(gap.modelAnswer, /^\p{L}{5,}$/u, "a whole word, accents included");
    assert.match(gap.prompt, /^Complète cette phrase de la page 1 : “/);
  }
  assert.equal(frenchRecallQuestion("Définition", "La photosynthèse est la réaction par laquelle…"), "Qu’est-ce que la photosynthèse, d’après tes notes ?");
  assert.equal(frenchRecallQuestion("Où a-t-elle lieu ?", "Elle se déroule dans les chloroplastes."), "Où a-t-elle lieu ? Que disent tes notes ?");
  assert.equal(inNotesLanguage("Which of these does NOT match your notes on Osmose?", "fr", "Osmose"), "Laquelle de ces phrases ne correspond PAS à tes notes sur « Osmose » ?");
  assert.equal(inNotesLanguage("Which of these does NOT match your notes on Osmosis?", "en", "Osmosis"), "Which of these does NOT match your notes on Osmosis?");
});
