import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { confirmImportedTopics, gotoStart, startBuiltPlan, startFromFile } from "./helpers";
import { deck } from "./pptx-deck";

// The review's own notes: three short pasted sections at phone width.
const notes = `Photosynthesis
Photosynthesis is the process by which green plants convert light energy into chemical energy stored in glucose. It takes place in the chloroplasts, which contain the green pigment chlorophyll. Carbon dioxide and water are used, and oxygen is released as a by-product.

Cellular respiration
Cellular respiration releases energy from glucose so that cells can do work. Aerobic respiration uses oxygen and produces carbon dioxide and water. Most of the ATP is made in the mitochondria.

Enzymes
Enzymes are biological catalysts that speed up reactions without being used up. Each enzyme has an active site with a specific shape that fits one substrate. High temperatures denature an enzyme because the active site changes shape.`;

const SORTING = /^(Which of these is about|Which idea from your notes)/;

/** Plays one topic's quick checks, picking the first option, and returns each question with its line's move. */
async function playChecks(page: Page) {
  const asked: Array<{ prompt: string; move: string }> = [];
  for (let guard = 0; guard < 6; guard += 1) {
    const skip = page.getByRole("button", { name: "Skip to the questions" });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await expect(page.locator('#run-explain, input[id^="run-gap"]:not([disabled]), [role="group"][aria-label="Choose one"] button:not([disabled])').first()).toBeVisible();
    if (await page.locator("#run-explain").isVisible()) break;
    const check = page.locator('section[aria-label^="Check "]');
    const prompt = (await check.locator("h1, h2, p").first().innerText()).trim();
    const gap = page.locator('input[id^="run-gap"]:not([disabled])');
    if (await gap.count()) { await gap.fill("zzz"); await page.getByRole("button", { name: "Check", exact: true }).click(); }
    else await page.getByRole("group", { name: "Choose one" }).getByRole("button").first().click();
    const move = (await page.getByLabel(/^This line: /).getAttribute("aria-label").catch(() => "")) ?? "";
    asked.push({ prompt, move });
    await page.getByRole("button", { name: /^(Next question|Next(?! section)|Now say it yourself)/ }).click();
  }
  return asked;
}

test("short notes: no topic-sorting questions, open recall in the notes' order, and a reversed answer is not nailed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoStart(page);
  await page.getByText("Or paste your notes").click();
  await page.locator("#paste-notes").fill(notes);
  await page.getByRole("button", { name: "Use these notes" }).click();
  // The topics keep the order of the notes.
  const review = page.getByRole("heading", { name: "Check the topics in your notes." });
  await expect(review).toBeVisible();
  const order = await page.locator("main strong").filter({ hasText: /^(Photosynthesis|Cellular Respiration|Enzymes)$/ }).allInnerTexts();
  expect(order).toEqual(["Photosynthesis", "Cellular Respiration", "Enzymes"]);
  await confirmImportedTopics(page);
  await startBuiltPlan(page);
  await expect(page).toHaveURL(/\/session/);

  const asked = await playChecks(page);
  for (const { prompt, move } of asked) {
    expect(prompt).not.toMatch(SORTING);
    // A pick from choices never counts as recall: the line is never shown moving on.
    if (!/Fill the gap/.test(prompt)) expect(move).not.toMatch(/Recalled/);
  }
  expect(new Set(asked.map((item) => item.prompt)).size).toBe(asked.length);

  await expect(page.getByRole("heading", { name: /photosynthesis, according to your notes|Explain photosynthesis|explain photosynthesis to a friend/i })).toBeVisible();
  await page.locator("#run-explain").fill("Green plants convert chemical energy into light energy stored in oxygen.");
  await page.getByRole("button", { name: /Compare with the page/ }).click();
  // The page's words, backwards: the suggested grade is a miss, never "Nailed it".
  await expect(page.getByRole("button", { name: /Missed it/ })).toContainText("Suggested");
  await expect(page.getByRole("button", { name: /Nailed it/ })).not.toContainText("Suggested");
});

test("a longer PDF: its first session asks about content, not topics, and picks never move a line on", async ({ page }) => {
  test.setTimeout(90_000);
  await startFromFile(page, { name: "econ-lecture-4-elasticity.pdf", mimeType: "application/pdf", buffer: readFileSync("tests/fixtures/course-pdfs/econ-lecture-4-elasticity.pdf") });
  const asked = await playChecks(page);
  for (const { prompt, move } of asked) {
    expect(prompt).not.toMatch(SORTING);
    if (!/Fill the gap/.test(prompt)) expect(move).not.toMatch(/Recalled/);
  }
  await expect(page.locator("#run-explain")).toBeVisible();
});

test("PowerPoint slides are read as they are: each titled slide becomes a topic to check", async ({ page }) => {
  await gotoStart(page);
  await page.locator('input[type="file"]').setInputFiles({ name: "Biology lecture 3.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", buffer: Buffer.from(deck) });
  await expect(page.getByRole("heading", { name: "Check the topics in your notes." })).toBeVisible({ timeout: 45_000 });
  await expect(page.locator("main")).toContainText("Photosynthesis");
  await expect(page.locator("main")).toContainText("Enzymes");
});
