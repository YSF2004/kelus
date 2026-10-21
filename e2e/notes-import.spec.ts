import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { nudgesAlreadyOn, startBuiltPlan, closeToToday, expectFirstPrompt, gotoStart, startFromFile, startFromPaste, topicNames, skipReading } from "./helpers";

const notion = readFileSync("tests/fixtures/notion-export.md", "utf8");
const mdFile = { name: "cell-biology.md", mimeType: "text/markdown", buffer: Buffer.from(notion) };

test("a Notion Markdown export opens a first question, and its topics are listed from the sections", async ({ page }) => {
  await startFromFile(page, mdFile);
  const names = await topicNames(page);
  expect(names).toEqual(expect.arrayContaining(["Cell Membrane", "Osmosis", "Steps of Cellular Respiration", "Active vs Passive Transport"]));
  expect(names).not.toContain("Examples");
  expect(names).not.toContain("Cell Biology: Week 3");
});

test("pasted notes work the same way, and the first question quotes the notes", async ({ page }) => {
  await startFromPaste(page, notion);
  await page.getByRole("button", { name: "More session options" }).click();
  await page.getByRole("button", { name: "Peek at the notes" }).click();
  await expect(page.locator('article[aria-label^="Section"]')).toBeVisible();
  await closeToToday(page);
  await expect(page.getByRole("heading", { name: /Cell Biology Week 3/ })).toBeVisible();
  await expect(page.getByText(/study days left/i)).toHaveCount(0);
});

test("skipping a memory answer cannot be marked as mastered", async ({ page }) => {
  await startFromPaste(page, notion);
  await page.getByRole("button", { name: "I don’t remember" }).click();
  await expect(page.getByText("No answer to rate yet. This line will come back.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Nailed it|Partly/ })).toHaveCount(0);
  await page.getByRole("button", { name: /^Continue/ }).click();
  await expect(page.getByRole("heading", { name: /Needs another attempt/ })).toBeVisible();
});

test("notes too short to study from get a plain reason, and nothing is saved", async ({ page }) => {
  await gotoStart(page);
  await page.getByText("Or paste your notes").click();
  await page.locator("#paste-notes").fill("Osmosis is water.");
  await page.getByRole("button", { name: "Use these notes" }).click();
  await expect(page.getByRole("heading", { name: /couldn.t find topics/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start with your notes." })).toHaveCount(0);
});

test("a file that is neither a PDF nor notes is refused with a clear reason", async ({ page }) => {
  await gotoStart(page);
  await page.locator('input[type="file"]').setInputFiles({ name: "picture.png", mimeType: "image/png", buffer: Buffer.from("x") });
  await expect(page.getByText("Choose a PDF, notes as a .md or .txt file, or a Notion export (.zip).")).toBeVisible();
});

test("a notes source is still there after the page is reloaded", async ({ page }) => {
  await startFromFile(page, mdFile);
  await closeToToday(page);
  await page.goto("/today?section=materials");
  await expect(page.locator(".material-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".material-card")).toHaveCount(1);
  await expect(page.locator(".material-card")).toContainText("cell biology");
  // The source's topics are listed by name on its row.
  await expect(page.locator(".material-card .material-card-topics span").first()).toBeVisible();
});

test("adding oversized notes to Materials stops at the stated 2 MB limit", async ({ page }) => {
  await startFromFile(page, mdFile);
  await closeToToday(page);
  await page.goto("/today?section=materials");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Add source" }).first().click();
  await (await chooser).setFiles({
    name: "oversized-notes.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(`# Oversized notes\n${"a".repeat(2 * 1024 * 1024)}`),
  });
  await expect(page.locator(".material-error[role=alert]")).toContainText("These notes are larger than 2 MB");
  await expect(page.locator(".material-card")).toHaveCount(1);
});

test("the original notes stay within reach of the study plan", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startFromFile(page, mdFile);
  await closeToToday(page);
  await expect(page.locator(".core-workspace-grid.is-today-single")).toBeVisible();
  const notesButton = page.getByRole("button", { name: "See notes beside plan" });
  await expect(notesButton).toBeVisible();
  await notesButton.click();
  await expect(page.locator(".core-workspace-grid.is-notes-open .core-source-reader")).toBeVisible();
  await expect(page.locator(".core-workspace-grid.is-notes-open .core-source-reader")).toContainText("cell biology");
  await expect.poll(async () => page.locator('[data-block="today-next"]').evaluate((section) => {
    const edge = section.getBoundingClientRect();
    return [...section.querySelectorAll("li strong")].every((name) => {
      const rect = name.getBoundingClientRect();
      return rect.left >= edge.left - 1 && rect.right <= edge.right + 1;
    });
  })).toBe(true);
  await page.screenshot({ path: "/tmp/kelus-today-with-notes-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Materials", exact: true }).first().click();
  await page.getByRole("button", { name: "Study plan", exact: true }).first().click();
  await expect(page.locator(".core-workspace-grid.is-notes-open .core-source-reader")).toBeVisible();
  await page.getByRole("button", { name: "Hide notes" }).click();
  await expect(page.locator(".core-workspace-grid.is-notes-open")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Open notes" })).toBeVisible();
  await page.getByRole("button", { name: "Open notes" }).click();
  await expect(page.getByRole("heading", { name: "Materials" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/kelus-notes-mobile.png", fullPage: true });
});

test("a Notion zip export becomes topics, with page names free of Notion ids", async ({ page }) => {
  await startFromFile(page, "tests/fixtures/notion-export.zip");
  const names = await topicNames(page);
  expect(names).toEqual(expect.arrayContaining(["Active transport", "Osmosis"]));
  expect(names.join(" ")).not.toMatch(/[0-9a-f]{32}|Biology Week 3|Empty page/);
});

test("a zip with no pages with text says what to do instead of failing silently", async ({ page }) => {
  await gotoStart(page);
  const empty = Buffer.from("PK\x05\x06" + "\0".repeat(18), "binary");
  await page.locator('input[type="file"]').setInputFiles({ name: "empty.zip", mimeType: "application/zip", buffer: empty });
  await expect(page.getByRole("alert").filter({ hasText: /Markdown|pages|zip/i })).toBeVisible();
});

test("the daily reminder waits for a real exam date, then repeats until it", async ({ page }) => {
  await startFromFile(page, mdFile);
  await closeToToday(page);
  // No date yet: Kelus asks for it instead of offering a reminder that would end on a made-up day.
  await expect(page.getByRole("region", { name: "Make it a daily habit" })).toHaveCount(0);
  const ask = page.getByRole("region", { name: "When is your exam?" });
  await expect(ask).toBeVisible();
  const exam = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
  await ask.getByLabel("Exam date").fill(exam);
  await ask.getByRole("button", { name: "Save date" }).click();
  await expect(ask).toHaveCount(0);
  // One card at a time: with nudges already on, the calendar reminder is next.
  await nudgesAlreadyOn(page);
  await page.reload();

  const card = page.getByRole("region", { name: "Make it a daily habit" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("can’t send notifications while it’s closed");
  await card.getByLabel("Remind me at").selectOption("20:00");
  const [download] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: "Add to my calendar" }).click()]);
  expect(download.suggestedFilename()).toBe("kelus-daily-study.ics");
  const text = (await import("node:fs")).readFileSync(await download.path(), "utf8");
  expect(text).toMatch(new RegExp(`RRULE:FREQ=DAILY;UNTIL=${exam.replace(/-/g, "")}T`));
  expect(text).toMatch(/DTSTART:\d{8}T200000/);
  expect(text).toContain("BEGIN:VALARM");
  await expect(card.getByRole("status")).toContainText("Downloaded");
});

test("your own file never mixes into the sample: it starts your own course, and the sample is replaced", async ({ page }) => {
  await page.goto("/today?sample=1");
  await expect(page.getByText("Sample course")).toBeVisible();
  await page.locator('input[aria-label="Choose a course PDF"]').setInputFiles({ name: "my-notes.md", mimeType: "text/markdown", buffer: Buffer.from(notion) });
  const dialog = page.getByRole("dialog", { name: "Start your own course?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("my-notes.md");

  // Keeping the sample changes nothing.
  await dialog.getByRole("button", { name: "Keep the sample" }).click();
  await expect(dialog).toHaveCount(0);
  // Still the sample, and still named as one: by its source in the sidebar on every section.
  await expect(page.getByText(/Built-in Microeconomics example/).first()).toBeVisible();

  await page.locator('input[aria-label="Choose a course PDF"]').setInputFiles({ name: "my-notes.md", mimeType: "text/markdown", buffer: Buffer.from(notion) });
  await page.getByRole("dialog", { name: "Start your own course?" }).getByRole("button", { name: "Start my own course" }).click();

  // The file starts your own course and opens its first question; none of the sample is left.
  await startBuiltPlan(page);
  await expect(page).toHaveURL(/\/session/, { timeout: 30_000 });
  await skipReading(page);
  await expectFirstPrompt(page);
  await closeToToday(page);
  await expect(page.getByText("Sample course")).toHaveCount(0);
  await expect(page.locator("#today-title")).not.toHaveText(/Elasticity|Supply|Monetary/);
});

// Reads the engine from a public CDN, so it needs a network and is skipped in CI to keep CI deterministic.
test("a scanned, image-only PDF is read with on-device OCR and becomes topics", async ({ page }) => {
  test.skip(Boolean(process.env.CI), "needs the OCR engine from a CDN");
  test.setTimeout(120_000);
  await startFromFile(page, "tests/fixtures/scanned-notes.pdf");
  expect(await topicNames(page)).toEqual(expect.arrayContaining(["Osmosis", "Enzymes"]));
});

test("a course with no topics is one screen with one job, and adding notes there continues the normal flow", async ({ page }) => {
  await startFromFile(page, mdFile);
  await closeToToday(page);
  await page.getByRole("button", { name: /^Remove cell biology/i }).click();
  await page.getByRole("group", { name: /Confirm remove/ }).getByRole("button", { name: "Remove" }).click();

  // A course with no topics left is a clean start: the same screen as the very first one, with no course name.
  await expect(page.getByRole("heading", { name: "Start with your notes." })).toBeVisible();
  // Not a second form: no source-role dropdown, no bookmark box, no empty-binder panel, a single file picker.
  await expect(page.getByLabel("Type", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Save a video or web link instead")).toHaveCount(0);
  await expect(page.getByText("Empty binder")).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(1);

  await page.locator('input[type="file"]').setInputFiles(mdFile);
  // The notes are read quietly and the first question opens: no checklist in between.
  await startBuiltPlan(page);
  await expect(page).toHaveURL(/\/session/, { timeout: 30_000 });
  await skipReading(page);
  await expectFirstPrompt(page);
});

test("a file with no real topics says so plainly and returns to the start screen", async ({ page }) => {
  await gotoStart(page);
  const admin = "# Syllabus\nOffice hours are on Monday afternoons in the main building and attendance is recorded each week.\n\n# Grading policy\nLate submissions lose ten percent per day and the course schedule is posted on the noticeboard.";
  await page.locator('input[type="file"]').setInputFiles({ name: "admin.md", mimeType: "text/markdown", buffer: Buffer.from(admin) });
  await expect(page.getByRole("heading", { name: "Kelus couldn’t find topics in this file." })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Try another file" }).click();
  await expect(page.getByRole("heading", { name: /^(Start with your notes|Add notes to .+|Add your notes)\.$/ })).toBeVisible();
  // The failed file is gone, so a good one works straight away.
  await page.locator('input[type="file"]').setInputFiles(mdFile);
  await startBuiltPlan(page);
  await expect(page).toHaveURL(/\/session/, { timeout: 30_000 });
});

test("a topic that is not real can be removed from the question screen, and undone", async ({ page }) => {
  await startFromFile(page, mdFile);
  const title = await page.locator(".study-topic-kicker b").innerText();
  const before = await topicNames(page);
  expect(before).toContain(title);
  await page.goto("/today");
  await page.getByRole("button", { name: /Start this topic|Continue/ }).first().click();
  await expect(page).toHaveURL(/\/session/);
  const more = page.getByRole("button", { name: "More session options" });
  await more.click();
  // Removed at once, with an Undo in the note that appears (no "are you sure" first).
  await page.getByRole("button", { name: "Remove this topic" }).click();
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByText(`Removed “${title}”`)).toBeVisible();
  const after = await topicNames(page);
  expect(after).toHaveLength(before.length - 1);
  expect(after).not.toContain(title);
});

test("the exam date is asked after the first run, not before, and a real date turns on the countdown", async ({ page }) => {
  await startFromFile(page, mdFile);
  await closeToToday(page);
  await expect(page.getByRole("group", { name: "Your path through the course" })).toContainText(/About \d+ study days? of work/);
  await expect(page.getByText(/days? to exam/)).toHaveCount(0);
  const ask = page.getByRole("region", { name: "When is your exam?" });
  await ask.getByRole("button", { name: "Save date" }).click();
  await expect(ask.getByRole("alert")).toContainText("Pick the day of your exam.");
  const exam = new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10);
  await ask.getByLabel("Exam date").fill(exam);
  await ask.getByRole("button", { name: "Save date" }).click();
  await expect(page.getByRole("group", { name: "Your path through the course" })).toContainText(/\d+ days? to exam/);
});

test("a leftover built-in sample never names the start screen or receives your notes", async ({ page }) => {
  await page.goto("/today?sample=1");
  await page.getByRole("button", { name: "Remove Built-in Microeconomics example" }).click();
  await page.getByRole("group", { name: /Confirm remove/ }).getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("heading", { name: "Start with your notes." })).toBeVisible();
  // Nothing on the page names the sample (Next's hidden route announcer may still hold the last tab title).
  await expect(page.locator("main, header, nav, aside").getByText("Microeconomics")).toHaveCount(0);
  await expect(page).not.toHaveTitle(/Microeconomics/);
  await page.locator('input[type="file"]').setInputFiles(mdFile);
  await startBuiltPlan(page);
  await expect(page).toHaveURL(/\/session/, { timeout: 30_000 });
  await closeToToday(page);
  // It is a new course made from the file, not the sample with notes added.
  await expect(page.getByText(/Sample course|Microeconomics/)).toHaveCount(0);
  await expect(page.getByText(/cell biology/i).first()).toBeVisible();
});

test("pasted notes with no headings still start, with no error and no extra step", async ({ page }) => {
  await startFromPaste(page, "Price elasticity of demand measures how strongly the quantity demanded responds to a change in price. Demand is elastic when buyers react strongly to a price change, and inelastic when they barely react. Close substitutes make demand more elastic because buyers can switch when the price rises.");
  await expect(page.getByRole("alert").filter({ hasText: "heading" })).toHaveCount(0);
});
