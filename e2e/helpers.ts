import { expect, type Page } from "@playwright/test";

export type UploadFile = string | { name: string; mimeType: string; buffer: Buffer };

/** Opens the start screen and waits until its scripts have run, so a file chosen at once is not lost. */
export async function gotoStart(page: Page) {
  await page.goto("/today", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Start with your notes." })).toBeVisible();
}

/** After import, the student checks what Kelus read before the first question. */
export async function confirmImportedTopics(page: Page) {
  await expect(page.getByRole("heading", { name: "Check the topics Kelus found." })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: /^Use \d+ topics?$/ }).click();
}

/** After notes are read, Kelus shows what it built; one tap starts the first topic. */
/** A new topic opens on its lines to read; most tests are about the checks, so they step past the reading. */
export async function skipReading(page: Page) {
  const reading = page.getByRole("region", { name: "Read it first" });
  await reading.or(page.locator('section[aria-label^="Check "]')).or(page.locator("#run-explain")).first().waitFor({ timeout: 30_000 });
  if (await reading.count()) await reading.getByRole("button", { name: "Skip to the questions" }).click();
}

export async function startBuiltPlan(page: Page) {
  const start = page.getByRole("button", { name: /^Start$/ });
  const review = page.getByRole("heading", { name: "Check the topics Kelus found." });
  await review.or(start).or(page.getByLabel(/^Check 1 of \d$/)).or(page.getByRole("region", { name: "Read it first" })).or(page.locator("#run-explain")).first().waitFor({ timeout: 45_000 });
  if (await review.count()) await confirmImportedTopics(page);
  if (await start.count()) await start.click();
}

/** Sparse notes can support an own-words explanation but no fair instant check. */
export async function expectFirstPrompt(page: Page) {
  await expect(page.getByLabel(/^Check 1 of \d$/).or(page.locator("#run-explain"))).toBeVisible();
}

export async function startFromFile(page: Page, file: UploadFile) {
  await gotoStart(page);
  await page.locator('input[type="file"]').setInputFiles(file);
  await confirmImportedTopics(page);
  await startBuiltPlan(page);
  await expect(page).toHaveURL(/\/session/, { timeout: 30_000 });
  await skipReading(page);
  await expectFirstPrompt(page);
}

export async function startFromPaste(page: Page, text: string) {
  await gotoStart(page);
  await page.getByText("Or paste your notes").click();
  await page.locator("#paste-notes").fill(text);
  await page.getByRole("button", { name: "Use these notes" }).click();
  await confirmImportedTopics(page);
  await startBuiltPlan(page);
  await expect(page).toHaveURL(/\/session/, { timeout: 30_000 });
  await skipReading(page);
  await expectFirstPrompt(page);
}

/** Leaves the first question and lands on Today. */
export async function closeToToday(page: Page) {
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator("#today-title")).toBeVisible();
}

export async function topicNames(page: Page) {
  await page.goto("/today?section=map");
  await expect(page.locator(".index-toc-name").first()).toBeVisible();
  return page.locator(".index-toc-name").allInnerTexts();
}

/** Answers every quick check (a wrong gap word, or option 1), then explains and rates itself. */
export async function playQuickRun(page: Page, explanation = "It depends on how easily buyers can switch.", grade = "Nailed it") {
  await skipReading(page);
  for (let guard = 0; guard < 6; guard += 1) {
    await expect(page.locator('#run-explain, input[id^="run-gap"]:not([disabled]), [role="group"][aria-label="Choose one"] button:not([disabled])').first()).toBeVisible();
    if (await page.locator("#run-explain").count()) break;
    const gap = page.locator('input[id^="run-gap"]:not([disabled])');
    if (await gap.count()) {
      await gap.fill("zzz");
      await page.getByRole("button", { name: "Check", exact: true }).click();
    } else {
      await page.getByRole("group", { name: "Choose one" }).getByRole("button").first().click();
    }
    await page.getByRole("button", { name: /^(Next|Now say it yourself)/ }).click();
  }
  await page.locator("#run-explain").fill(explanation);
  await page.getByRole("button", { name: /Compare with the page/ }).click();
  await page.getByRole("button", { name: new RegExp(grade) }).click();
}

/** The sections, wherever they are on this screen size: the side column on wide screens, the bottom tab bar on a phone. */
export function sectionsNav(page: Page) {
  return page.locator('nav[aria-label="Revision sections"]:visible, nav[aria-label="Sections"]:visible').first();
}

/** Today shows one extra card at a time; this sets the exam date so the next ones (nudges, install, reminder) can show. */
export async function saveExamDate(page: Page, daysAhead = 9) {
  const ask = page.getByRole("region", { name: "When is your exam?" });
  await ask.getByLabel("Exam date").fill(new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10));
  await ask.getByRole("button", { name: "Save date" }).click();
  await expect(ask).toHaveCount(0);
}

/** Marks nudges as already on, so Today moves on to the next card. */
export async function nudgesAlreadyOn(page: Page) {
  await page.evaluate(() => window.localStorage.setItem("kelus-nudge-v1", JSON.stringify({ on: true, time: "18:00" })));
}
