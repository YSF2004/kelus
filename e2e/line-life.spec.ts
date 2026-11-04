import { expect, test } from "@playwright/test";
import { playQuickRun, startFromPaste } from "./helpers";

const notes = "Osmosis\nOsmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. In a hypotonic solution a plant cell gains water and becomes turgid because the cell wall pushes back. In a hypertonic solution the cell loses water and becomes plasmolysed.";

test("on Progress a line opens its whole story: the notes, how it is asked, its answers, and where it is now", async ({ page }) => {
  await startFromPaste(page, notes);
  await playQuickRun(page, "Water moves across a membrane.", "Partly");
  await page.goto("/today?section=progress");
  // The chart draws once a line is recalled; until then one sentence stands in for a line flat on zero.
  await expect(page.getByRole("img", { name: /^Lines you can recall/ }).or(page.getByText(/your line starts rising here/))).toBeVisible();
  await page.getByRole("button", { name: /See this line's answers and when it is back$/ }).first().click();
  const sheet = page.getByRole("dialog", { name: "The life of this line" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("From your notes");
  await expect(sheet).toContainText("Your answers");
  await expect(sheet).toContainText("Where it is now");
  await expect(sheet.getByRole("list", { name: /^In Box \d of 5$/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  // Escape closed the sheet only: the list it was opened from is still there.
  await expect(page.getByRole("button", { name: /See this line's answers/ }).first()).toBeVisible();
});
