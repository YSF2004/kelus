import { expect, test, type Page } from "@playwright/test";
import { closeToToday, startFromFile, startFromPaste } from "./helpers";

const notes = "Cell Membranes\nThe plasma membrane is a phospholipid bilayer. Each phospholipid has a hydrophilic head and two hydrophobic tails. The hydrophilic heads face the watery fluid inside and outside the cell, while the hydrophobic tails point inward, away from water. The membrane is selectively permeable because its hydrophobic core lets small nonpolar molecules pass but blocks ions and large polar molecules.\n\nOsmosis\nOsmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. In a hypotonic solution a plant cell gains water and becomes turgid.\n\nActive transport\nActive transport moves substances against their concentration gradient. It needs energy from respiration in the form of ATP, and it uses carrier proteins in the membrane.";

/** The consequence Study shows for a topic answered today, saved answer by answer. */
const attempt = (page: Page) => page.locator('[data-block="today-attempt"]');

test("an existing course opens on a question worth thinking about; a wrong answer is corrected from the notes and its consequence survives closing and a refresh", async ({ page }) => {
  // A course that already exists: made from pasted notes, then left before answering anything.
  await startFromPaste(page, notes);
  await closeToToday(page);
  await expect(attempt(page)).toHaveCount(0);
  await page.getByRole("button", { name: /^(Start|Continue) revising/ }).click();
  await expect(page).toHaveURL(/\/session/);

  // The first question asks for a reason in the student's own words, quoting the notes; it is not term matching.
  const first = page.locator('section[aria-label="Explain it"]');
  await expect(first.getByRole("heading", { level: 1 })).toHaveText("Your notes say: “The membrane is selectively permeable.” Why? Answer in your own words.");
  await expect(page.getByLabel(/^Check 1 of/)).toHaveCount(0);

  // A wrong answer: the correction says what was missing, shows the supporting line, and what Kelus will do.
  await page.locator("#run-explain").fill("It lets things through.");
  await page.getByRole("button", { name: /Compare with the page/ }).click();
  await expect(first.getByText("Not yet.")).toBeVisible();
  await expect(first.getByText(/^Your answer leaves out “hydrophobic core”/)).toBeVisible();
  await expect(first.getByText(/selectively permeable because its hydrophobic core lets small nonpolar molecules pass/)).toBeVisible();
  await expect(first.getByText("This line stays in Box 1. It comes back first in your next review.")).toBeVisible();
  // Clear-cut: no three-way rating to make, one Continue goes on; the student can still rate it themselves.
  await expect(first.getByRole("button", { name: /Nailed it/ })).toHaveCount(0);
  await expect(first.getByRole("button", { name: "Continue" })).toBeVisible();
  await first.getByRole("button", { name: "Rate it myself" }).click();
  await expect(first.getByRole("button", { name: /Partly/ })).toBeVisible();
  // A single short word is not credited as a key idea.
  await expect(first.getByText(/^You covered/)).toHaveCount(0);

  // Close mid-topic: Study says what happened and what it means for the plan.
  await closeToToday(page);
  await expect(attempt(page)).toHaveText("You started Cell Membranes today: 1 line missed. The missed line stays in Box 1 and comes back first, so Cell Membranes stays first.");
  await expect(page.locator("#today-title")).toHaveText("Cell Membranes");

  // A refresh keeps it: the answer was saved when it was given, not when the topic ended.
  await page.reload();
  await expect(attempt(page)).toContainText("1 line missed");

  // Progress counts it as attempted and missed, not as recalled and not as untouched.
  await page.locator('nav[aria-label="Revision sections"]').getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.locator("#progress-standing")).toContainText(/You have tried 1 of \d+ lines/);
  await expect(page.getByRole("list", { name: "Your lines so far" })).toContainText("1 missed, to try again");
});

test("a wrong quick check names the mistaken idea, marks the answer in the line, and states the line's move", async ({ page }) => {
  await startFromPaste(page, notes);
  // Past the own-words question, to the checks.
  await page.locator("#run-explain").fill("Its hydrophobic core lets small nonpolar molecules pass but blocks ions and large polar molecules.");
  await page.getByRole("button", { name: /Compare with the page/ }).click();
  // Every key idea, nothing reversed: one tap moves the line up, no self-rating asked.
  await expect(page.getByText(/^This line moves from Box 1 to Box 2\. Kelus asks it again in 2 days\.$/)).toBeVisible();
  await page.keyboard.press("Enter");
  const check = page.getByLabel(/^Check 1 of \d$/);
  await expect(check).toBeVisible();
  const gap = check.locator('input[id^="run-gap"]');
  if (await gap.count()) {
    await gap.fill("zzzz");
    await page.getByRole("button", { name: "Check", exact: true }).click();
  } else {
    await check.getByRole("group", { name: "Choose one" }).getByRole("button").last().click();
  }
  const feedback = check.getByRole("status");
  await expect(feedback).toBeVisible();
  await expect(feedback.locator("p").filter({ hasText: /Box \d/ })).toHaveText(/^(This line stays in Box 1\. It comes back first in your next review\.|This line moves from Box 1 to Box 2\. Kelus asks it again in 2 days\.|Tapped from four words)/);
});

test("a fresh course from a real local PDF reaches a first question and keeps a wrong answer's consequence", async ({ page }) => {
  test.setTimeout(120_000);
  await startFromFile(page, "tests/fixtures/course-pdfs/biology-ch7-cell-transport.pdf");
  // Either an own-words question from the PDF's lines, or an honest quick check that says why.
  const explain = page.locator("#run-explain");
  if (await explain.count()) {
    await explain.fill("I am not sure.");
    await page.getByRole("button", { name: /Compare with the page/ }).click();
    await expect(page.locator('section[aria-label="Explain it"] p').filter({ hasText: /Box 1/ })).toBeVisible();
  } else {
    await page.getByRole("button", { name: /I’m not sure/ }).click();
    await expect(page.getByRole("status").locator("p").filter({ hasText: /Box 1/ })).toBeVisible();
  }
  await closeToToday(page);
  await expect(attempt(page)).toContainText(/line(s)? missed|missed/);
  await page.reload();
  await expect(attempt(page)).toContainText("missed");
});
