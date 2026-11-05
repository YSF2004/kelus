import { expect, test } from "@playwright/test";
import { playQuickRun, startFromPaste } from "./helpers";

const notes = "Cell biology\n\nOsmosis\nOsmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. In a hypotonic solution a plant cell gains water and becomes turgid.\n\nEnzymes\nEnzymes are biological catalysts that speed up reactions without being used up. Each enzyme has an active site with a specific shape.";

test("the revision sheet lays the student's own words beside their notes, and topics not yet explained invite it", async ({ page }) => {
  await startFromPaste(page, notes);
  await playQuickRun(page, "Water moves across the membrane to the more concentrated side.", "Nailed it");
  await page.goto("/today?section=map");
  await page.getByRole("link", { name: "Open the sheet" }).click();
  await expect(page).toHaveURL(/\/sheet/);
  await expect(page.getByRole("heading", { level: 1, name: "The sheet you wrote." })).toBeVisible();
  const list = page.getByRole("list", { name: "Topics, in the order of your notes" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveCount(2);
  await expect(list).toContainText("“Water moves across the membrane to the more concentrated side.”");
  await expect(list.getByRole("link", { name: "Explain it" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeEnabled();
  // The product's own header is not on the sheet: its bar is the only one.
  await expect(page.locator(".site-header")).toBeHidden();
});
