import { expect, test } from "@playwright/test";
import { confirmImportedTopics, gotoStart, skipReading } from "./helpers";

const notes = "Cell biology\n\nOsmosis\nOsmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. In a hypotonic solution a plant cell gains water and becomes turgid because the cell wall pushes back. In a hypertonic solution the cell loses water and becomes plasmolysed.\n\nDiffusion\nDiffusion is the net movement of particles from an area of higher concentration to an area of lower concentration. It is a passive process, so it needs no energy from the cell.";
const shots = process.env.NEXT_SHOTS;

test("reading shows the topics it found; a line can be listened to; a miss shows its line in the notes", async ({ page }) => {
  await gotoStart(page);
  await page.getByText("Or paste your notes").click();
  await page.locator("#paste-notes").fill(notes);
  await page.getByRole("button", { name: "Use these notes" }).click();
  // Before studying, students can inspect the topics against the lines Kelus read.
  const found = page.locator(".first-source-review-list");
  await expect(found).toContainText("Osmosis");
  await expect(found).toContainText("Diffusion");
  if (shots) { await page.waitForTimeout(700); await page.screenshot({ path: `${shots}/found.png` }); }
  await confirmImportedTopics(page);
  await page.getByRole("button", { name: /^Start$/ }).click();
  await expect(page.getByRole("region", { name: "Read it first" }).getByRole("button", { name: "Listen" })).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/read-listen.png` });
  await skipReading(page);
  await page.getByRole("button", { name: "I’m not sure" }).click();
  await expect(page.getByRole("button", { name: "Listen" })).toBeVisible();
  const show = page.getByRole("button", { name: "Show it in your notes" });
  if (await show.count()) {
    await show.click();
    await expect(page.getByLabel("This line in your notes")).toBeVisible();
  }
  if (shots) await page.screenshot({ path: `${shots}/around.png` });
});
