import { expect, test, type Page } from "@playwright/test";
import { confirmImportedTopics, gotoStart, playQuickRun, skipReading } from "./helpers";

const notes = "Cell biology\n\nOsmosis\nOsmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. In a hypotonic solution a plant cell gains water and becomes turgid because the cell wall pushes back. In a hypertonic solution the cell loses water and becomes plasmolysed.\n\nEnzymes\nEnzymes are biological catalysts that speed up reactions without being used up. Each enzyme has an active site with a specific shape, so it only binds one substrate. High temperatures denature an enzyme because the active site changes shape.\n\nDiffusion\nDiffusion is the net movement of particles from an area of higher concentration to an area of lower concentration. It is a passive process, so it needs no energy from the cell. The rate of diffusion increases with a steeper concentration gradient.";
const shots = process.env.RPR_SHOTS;

async function begin(page: Page) {
  await gotoStart(page);
  await page.getByText("Or paste your notes").click();
  await page.locator("#paste-notes").fill(notes);
  await page.getByRole("button", { name: "Use these notes" }).click();
  await confirmImportedTopics(page);
  await expect(page).toHaveURL(/\/session/, { timeout: 30_000 });
}

test("a new topic is read first, one line at a time, then asked; the recall count rises with a right answer", async ({ page }) => {
  await begin(page);
  const reading = page.getByRole("region", { name: "Read it first" });
  await expect(reading).toBeVisible();
  await expect(reading.locator("li")).toHaveCount(1);
  if (shots) await page.screenshot({ path: `${shots}/read-1.png` });
  await page.keyboard.press("Enter");
  await expect(reading.locator("li")).toHaveCount(2);
  // Enter steps through every line, then "Now from memory" opens the first check.
  for (let guard = 0; guard < 4 && (await reading.count()); guard += 1) {
    if (shots && guard === 0) await page.screenshot({ path: `${shots}/read-2.png` });
    await reading.getByRole("button", { name: /^(Continue|Now from memory)/ }).click();
  }
  await expect(page.getByLabel(/^Check 1 of \d$/)).toBeVisible();
  // Nothing recalled yet: no count in the bar until the first line comes back.
  const counter = page.getByLabel(/lines? from your notes answered correctly/);
  await expect(counter).toHaveCount(0);
  // Answer the first check right: the counter goes to 1.
  // Answer the first check: "Which idea…" is the topic itself; a gap gets the word the notes use.
  const check = page.getByLabel(/^Check 1 of \d$/);
  const gap = check.locator('input[id^="run-gap"]');
  if (await gap.count()) {
    await gap.fill("membrane");
    await page.getByRole("button", { name: "Check", exact: true }).click();
  } else {
    const options = check.getByRole("group", { name: "Choose one" }).getByRole("button");
    const topic = options.filter({ hasText: /^\d?\s*Osmosis$/ });
    await ((await topic.count()) ? topic.first() : options.first()).click();
  }
  if (shots) await page.screenshot({ path: `${shots}/check.png` });
  const right = await page.getByText(/^Right\./).count();
  if (right) await expect(counter).toContainText("1");
  else await expect(counter).toHaveCount(0);
});

test("Topics is a path in the order of the notes, with an exam check that opens once every topic is practised", async ({ page }) => {
  await begin(page);
  await skipReading(page);
  await page.goto("/today?section=map");
  const path = page.getByRole("list", { name: "Topics, in the order of your notes" });
  await expect(path.locator(".index-toc-name")).toHaveText(["Osmosis", "Enzymes", "Diffusion"]);
  await expect(page.getByRole("group", { name: "Where you are" })).toContainText("0 of 3 topics practised");
  await expect(page.getByRole("group", { name: "Where you are" })).toContainText("0/3practised");
  await expect(path.getByText("Exam check")).toBeVisible();
  await expect(path.getByText(/Unlocks after 3 more topics/)).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/path.png`, fullPage: true });
});

test("a checkpoint run is remembered on the path, with its score and when", async ({ page }) => {
  test.setTimeout(150_000);
  await begin(page);
  for (let topic = 0; topic < 3; topic += 1) {
    await playQuickRun(page, "Water moves across the membrane.", "Partly");
    const next = page.getByRole("button", { name: /^Continue to / });
    await next.or(page.getByRole("button", { name: /Finish block/ })).first().waitFor();
    if (!(await next.count())) break;
    await next.click();
  }
  await page.goto("/today?section=map");
  const path = page.getByRole("list", { name: "Topics, in the order of your notes" });
  await path.getByRole("link", { name: "Start: Exam check" }).click();
  // The run carries the checkpoint's own name and its pass mark.
  await expect(page.getByRole("heading", { name: "Exam check", exact: true })).toBeVisible();
  await expect(page.getByText(/Pass mark: \d of \d/)).toBeVisible();
  // Not sure on every line: tried, not passed.
  for (let guard = 0; guard < 6; guard += 1) {
    const unsure = page.getByRole("button", { name: "I’m not sure" });
    await unsure.or(page.getByRole("heading", { name: /this time\.|passed\./ })).first().waitFor();
    if (!(await unsure.count())) break;
    await unsure.click();
    await page.getByRole("button", { name: /^(Next|See how it went)/ }).click();
  }
  await expect(page.getByRole("heading", { name: /^0 of \d this time\.$/ })).toBeVisible();
  await expect(page.getByText(/back first next time\. Pass mark: \d of \d\./)).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/checkpoint-done.png` });
  await page.getByRole("link", { name: "See it on your path" }).click();
  const exam = page.getByRole("list", { name: "Topics, in the order of your notes" }).locator("li", { hasText: "Exam check" });
  await expect(exam).toContainText(/0 of \d from memory, today · pass at \d of \d/);
  await expect(exam.getByRole("link", { name: "Try again: Exam check" })).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/path-tried.png`, fullPage: true });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("a gap can be answered by tapping one of four words", async ({ page }) => {
    await begin(page);
    await skipReading(page);
    for (let guard = 0; guard < 4; guard += 1) {
      if (await page.locator('input[id^="run-gap"]:not([disabled])').count()) break;
      if (await page.locator("#run-explain").count()) test.skip(true, "no gap in this run");
      await page.getByRole("group", { name: "Choose one" }).getByRole("button").first().click();
      await page.getByRole("button", { name: /^(Next|Now say it yourself)/ }).click();
    }
    const chips = page.getByRole("group", { name: "Or tap the word" }).getByRole("button");
    await expect(chips).toHaveCount(4);
    if (shots) await page.screenshot({ path: `${shots}/phone-chips.png` });
    // A tap fills the gap; Check commits it, so a slip of the thumb can still be changed.
    await chips.first().click();
    await expect(chips.first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^(Next|Now say it yourself)/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(page.getByRole("button", { name: /^(Next|Now say it yourself)/ })).toBeVisible();
  });
});
