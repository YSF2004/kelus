import { expect, test } from "@playwright/test";
import { startBuiltPlan, startFromPaste, gotoStart } from "./helpers";

test("an uploaded PDF marks the course name with a folder, without changing its accessible name", async ({ page }) => {
  await gotoStart(page);
  await page.locator('input[type="file"]').setInputFiles("tests/fixtures/course-pdfs/biology-ch7-cell-transport.pdf");
  await startBuiltPlan(page);
  await expect(page).toHaveURL(/\/session/, { timeout: 30_000 });

  await page.goto("/today");
  const courseName = page.locator(".studio-topbar-course");
  await expect(courseName).toBeVisible();
  await expect(courseName.locator(".course-folder-icon")).toHaveCount(1);
  await expect(courseName.locator(".course-folder-icon")).toHaveAttribute("aria-hidden", "true");
  await expect(courseName).toHaveText("Cell Transport");
  await expect(page.getByRole("heading", { level: 1, name: "Cell Transport" })).toBeVisible();
  await expect(page.locator("h1 .course-folder-icon")).toHaveCount(1);
});

test("pasted notes do not claim there is a PDF in the course", async ({ page }) => {
  await startFromPaste(page, "Cell biology\n\nOsmosis\nOsmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. A plant cell gains water in a hypotonic solution and becomes turgid because its cell wall pushes back.");
  await page.goto("/today");
  await expect(page.locator(".studio-topbar-course")).toBeVisible();
  await expect(page.locator(".studio-topbar-course .course-folder-icon")).toHaveCount(0);
  await expect(page.locator("h1 .course-folder-icon")).toHaveCount(0);
});
