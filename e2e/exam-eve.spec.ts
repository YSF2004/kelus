import { expect, test } from "@playwright/test";
import { playQuickRun, saveExamDate, startFromPaste } from "./helpers";

const notes = "Cell biology\n\nOsmosis\nOsmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. In a hypotonic solution a plant cell gains water and becomes turgid.\n\nEnzymes\nEnzymes are biological catalysts that speed up reactions without being used up. Each enzyme has an active site with a specific shape.";

test("three days before the exam the plan opens on a calm countdown counted from your own answers", async ({ page }) => {
  await startFromPaste(page, notes);
  await playQuickRun(page, "Water moves across the membrane to the more concentrated side.", "Nailed it");
  await page.goto("/today");
  await expect(page.getByRole("region", { name: /lines\.$/ })).toHaveCount(0);
  // Two days out: three can land on a fourth calendar day near midnight, outside the window.
  await saveExamDate(page, 2);
  const eve = page.getByRole("region", { name: /^You can recall \d+ of \d+ lines\.$/ });
  await expect(eve).toBeVisible();
  await expect(eve).toContainText(/\d days to your exam|Your exam is tomorrow/);
  await expect(eve.getByRole("link", { name: "Read your sheet" })).toHaveAttribute("href", /\/sheet/);
});
