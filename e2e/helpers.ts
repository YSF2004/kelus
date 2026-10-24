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
  await page.getByRole("button", { name: "Start revising" }).click();
}

/** After notes are read, Kelus shows what it built; one tap starts the first topic. */
/** A new topic opens on its lines to read; most tests are about the checks, so they step past the reading. */
export async function skipReading(page: Page) {
  const reading = page.getByRole("region", { name: "Read it first" });
  await reading.or(page.locator('section[aria-label^="Check "]')).or(page.locator("#run-explain")).first().waitFor({ timeout: 30_000 });
  if (await reading.count()) await reading.getByRole("button", { name: "Skip to the questions" }).click();
}

export async function startBuiltPlan(page: Page) {
  const review = page.getByRole("heading", { name: "Check the topics Kelus found." });
  await review.or(page.getByLabel(/^Check 1 of \d$/)).or(page.getByRole("region", { name: "Read it first" })).or(page.locator("#run-explain")).first().waitFor({ timeout: 45_000 });
  if (await review.count()) await confirmImportedTopics(page);
}

/** Opens a reading of the topic's lines before its first question: offered beside the question, never imposed. */
export async function readFirst(page: Page) {
  await page.getByRole("button", { name: /^(Read the source first|Lire la source d’abord)$/ }).click();
  await expect(page.getByRole("region", { name: /^(Read it first|À lire d’abord)$/ })).toBeVisible();
}

/** Study, Materials or Progress, from the sidebar (or the phone's tab bar). */
export async function openSection(page: Page, name: "Study" | "Materials" | "Progress") {
  await sectionsNav(page).getByRole("button", { name, exact: true }).click();
}

/** Topics (rename, remove, checkpoints) opens from Materials, where the topics come from. */
export async function openTopics(page: Page) {
  await openSection(page, "Materials");
  await page.getByRole("button", { name: "Edit topics" }).click();
  await expect(page.getByRole("heading", { name: "Topics" })).toBeVisible();
}

/** The review schedule, boxes and readiness chart sit in one closed row on Progress. */
export async function openProgressDetails(page: Page) {
  const details = page.locator("details.progress-details");
  if (!(await details.getAttribute("open").then((value) => value !== null))) await details.locator("summary").click();
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
export async function playQuickRun(page: Page, explanation = "It depends on how easily buyers can switch.", grade = "Nailed it", gapWord = "zzz") {
  await skipReading(page);
  await answerRun(page, { explanation, grade, gapWord });
}

/**
 * Answers a whole topic in whichever order it comes: the own-words question first when the notes hold one, else last.
 * Checks are answered wrong (a nonsense gap word, the first option), so the run's outcome rests on the explanation.
 * Ends when the run leaves the question screens (the result card, the next topic's warm-up, or the end of the block).
 */
export async function answerRun(page: Page, input: { explanation: string; grade: string; gapWord?: string }) {
  const usable = page.locator('#run-explain, input[id^="run-gap"]:not([disabled]), [role="group"][aria-label="Choose one"] button:not([disabled])');
  let explained = false;
  for (let guard = 0; guard < 8; guard += 1) {
    if (guard > 0 && !(await usable.first().isVisible({ timeout: 2500 }).catch(() => false))) break;
    if (guard === 0) await expect(usable.first()).toBeVisible();
    if (await page.locator("#run-explain").count()) {
      if (explained) break;
      explained = true;
      await page.locator("#run-explain").fill(input.explanation);
      await page.getByRole("button", { name: /Compare with the page/ }).click();
      await rateAnswer(page, input.grade);
      continue;
    }
    const gap = page.locator('input[id^="run-gap"]:not([disabled])');
    if (await gap.count()) {
      await gap.fill(input.gapWord ?? "zzz");
      await page.getByRole("button", { name: "Check", exact: true }).click();
    } else {
      await page.getByRole("group", { name: "Choose one" }).getByRole("button").first().click();
    }
    const onward = page.getByRole("button", { name: /^(Next|Now say it yourself|See how it went)/ });
    const last = /See how it went/.test(await onward.innerText());
    await onward.click();
    if (last && explained) break;
  }
}

/** The sections, wherever they are on this screen size: the side column on wide screens, the bottom tab bar on a phone. */
export function sectionsNav(page: Page) {
  return page.locator('nav[aria-label="Revision sections"]:visible, nav[aria-label="Sections"]:visible').first();
}

/** Today shows one extra card at a time; this sets the exam date so the next ones (nudges, install, reminder) can show. */
export async function saveExamDate(page: Page, daysAhead = 9) {
  const ask = page.getByRole("region", { name: "When is your exam?" });
  // The exam date is asked on Progress, with what comes after today's topic.
  if (!(await ask.count())) await openSection(page, "Progress");
  await ask.getByLabel("Exam date").fill(new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10));
  await ask.getByRole("button", { name: "Save date" }).click();
  await expect(ask).toHaveCount(0);
}

/** Marks nudges as already on, so Today moves on to the next card. */
export async function nudgesAlreadyOn(page: Page) {
  await page.evaluate(() => window.localStorage.setItem("kelus-nudge-v1", JSON.stringify({ on: true, time: "18:00" })));
}

/** When a topic opens on its own-words question, answers it briefly so the quick checks after it can be tested. */
export async function passOwnWords(page: Page, grade = "Missed it") {
  const explain = page.locator("#run-explain");
  await explain.or(page.getByLabel(/^Check 1 of \d$/)).first().waitFor({ timeout: 30_000 });
  if (!(await explain.count())) return;
  await explain.fill("I am not sure what the notes say here.");
  await page.getByRole("button", { name: /Compare with the page/ }).click();
  await rateAnswer(page, grade);
  await expect(page.getByLabel(/^Check 1 of \d$/).or(page.getByRole("button", { name: /^(Continue to |Finish block)/ })).first()).toBeVisible();
}

/** Answers a whole topic with "not sure" and "I don’t remember", in whichever order it comes, up to its result card. */
export async function shrugRun(page: Page) {
  const end = page.getByRole("button", { name: /^(Continue to |Finish block)/ });
  for (let guard = 0; guard < 10; guard += 1) {
    const reading = page.getByRole("region", { name: "Read it first" });
    await page.locator("#run-explain").or(page.getByRole("button", { name: "I’m not sure" })).or(reading).or(end).first().waitFor({ timeout: 30_000 });
    if (await end.count()) return;
    if (await reading.count()) { await reading.getByRole("button", { name: "Skip to the questions" }).click(); continue; }
    if (await page.locator("#run-explain").count()) {
      await page.getByRole("button", { name: "I don’t remember" }).click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      continue;
    }
    await page.getByRole("button", { name: "I’m not sure" }).click();
    await page.getByRole("button", { name: /^(Next|Now say it yourself|See how it went)/ }).click();
  }
}

/**
 * Rates an own-words answer. When the comparison is clear-cut the run offers one "Continue" instead of three choices;
 * "Rate it myself" opens them, so a test can still give the rating it means to.
 */
export async function rateAnswer(page: Page, grade: string) {
  const choice = page.getByRole("button", { name: new RegExp(grade) });
  const myself = page.getByRole("button", { name: "Rate it myself" });
  await choice.or(myself).first().waitFor();
  if (await myself.count()) await myself.click();
  await choice.click();
}
