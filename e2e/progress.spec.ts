import { expect, test, type Page } from "@playwright/test";
import { answerRun, closeToToday, openProgressDetails, startFromPaste, skipReading } from "./helpers";

const notes = `# Osmosis
Osmosis is the movement of water across a selectively permeable membrane from a region of low solute concentration to a region of high solute concentration. Water moves toward the side with more solute because the solute lowers the water potential there.

# Enzymes
Enzymes are biological catalysts, almost always proteins, that speed up reactions by lowering the activation energy. Each enzyme has an active site whose shape fits a specific substrate, which is why enzymes are specific.

# Active transport
Active transport moves substances across a membrane against their concentration gradient, from low to high concentration, and it requires energy in the form of ATP.`;

async function newCourse(page: Page) {
  await startFromPaste(page, notes);
  await closeToToday(page);
}

async function playRun(page: Page) {
  await skipReading(page);
  await answerRun(page, { explanation: "It moves water toward more solute.", grade: "Nailed it" });
}

test("a brand-new course says it is too early instead of inventing a trend", async ({ page }) => {
  await newCourse(page);
  await page.getByRole("navigation", { name: "Revision sections" }).getByRole("button", { name: "Progress" }).click();
  await expect(page.getByRole("heading", { name: "Progress", level: 1 })).toBeVisible();
  // Up top, in plain words: nothing practised yet. The schedule and counts are one closed row below.
  await expect(page.getByText("Nothing practised yet. Answer a question and its line lights up here.")).toBeVisible();
  // The sheet is the notes themselves, every topic on it, nothing marked yet.
  await expect(page.getByRole("article", { name: "Your notes, marked by your answers" })).toContainText("Osmosis");
  await openProgressDetails(page);
  await expect(page.locator("#progress-headline")).toHaveText("Your progress starts with a first answer.");
  await expect(page.locator("#progress-headline")).toBeVisible();
  // No estimate and no exam date: no row of dashes.
  await expect(page.getByText("Readiness after 6 answers", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("img", { name: /Estimated readiness over 14 days/ })).toHaveCount(0); // no chart yet
  await expect(page.getByRole("region", { name: "Not started" })).toContainText("Osmosis");
  await expect(page.getByRole("link", { name: /Practise a topic/ })).toBeVisible();
});

test("after answering, the screen counts the answers but still does not claim a trend from one topic", async ({ page }) => {
  await newCourse(page);
  await page.locator('button[data-action="start-topic"]').click();
  await playRun(page);
  await page.goto("/today?section=progress");
  // A few answers in: each topic you tried, how it went and when it comes back. No trend, no counts, no dashes.
  await expect(page.locator("#progress-headline")).toHaveText(/1 of \d+ topics tried/);
  await expect(page.getByRole("img", { name: /Estimated readiness over 14 days/ })).toHaveCount(0);
  await expect(page.getByText(/Readiness after 6 answers/)).toHaveCount(0);
  const tried = page.locator('section[aria-labelledby="progress-headline"] li').first();
  await expect(tried).toContainText("Osmosis");
  await expect(tried).toContainText(/(Solid|Partly there|Missed), back /);
  await expect(page.getByText(/^Not started: /)).not.toContainText("Osmosis");
});

test("the sample course has history, so it shows a real trend with a chart and a pace line", async ({ page }) => {
  await page.goto("/today?sample=1");
  await page.getByRole("navigation", { name: "Revision sections" }).getByRole("button", { name: "Progress" }).click();
  await openProgressDetails(page);
  await expect(page.locator("#progress-headline")).not.toContainText("Too early");
  await expect(page.getByRole("img", { name: /Estimated readiness over 14 days/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Pace to your target" })).toContainText("a day");
  // A topic is in one list only.
  const stronger = await page.getByRole("region", { name: "Got stronger" }).locator("li strong").allInnerTexts();
  const needs = await page.getByRole("region", { name: "Needs another pass" }).locator("li strong").allInnerTexts();
  for (const name of stronger) expect(needs).not.toContain(name);
});

test("Progress is one click from Today, in the sections", async ({ page }) => {
  await newCourse(page);
  await page.locator('nav[aria-label="Revision sections"]').getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page).toHaveURL(/section=progress/);
  await expect(page.getByRole("article", { name: "Your notes, marked by your answers" })).toBeVisible();
  await openProgressDetails(page);
  await expect(page.locator("#progress-headline")).toBeVisible();
});
