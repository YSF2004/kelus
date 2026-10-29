import { expect, test } from "@playwright/test";
import { gotoStart } from "./helpers";

test("a CV is not turned into a study plan without asking, and the student can still go on", async ({ page }) => {
  await gotoStart(page);
  await page.getByText("Or paste your notes").click();
  await page.locator("#paste-notes").fill("Sam Example\nsam@example.com · +44 7700 900000 · linkedin.com/in/sam\n\nBachelor of Business\nBachelor of Business Administration, Example University, 2020 – 2023.\n\nAccounting Intern\nExample Ltd, 2022 – Present. Prepared monthly reports.\n\nSkills\nExcel, Commercial strategy, French.");
  await page.getByRole("button", { name: "Use these notes" }).click();
  await expect(page.getByRole("heading", { name: "Is this a file to revise?" })).toBeVisible();
  await expect(page.locator(".first-source-kind")).toContainText("This looks like a CV, not course notes.");
  await expect(page.getByRole("button", { name: "Start first question" })).toBeHidden();
  await page.getByRole("button", { name: "Use it anyway" }).click();
  await expect(page.getByRole("heading", { name: "Start with a question." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start first question" })).toBeVisible();
});
