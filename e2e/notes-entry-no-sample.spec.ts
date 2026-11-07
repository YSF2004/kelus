import { expect, test } from "@playwright/test";

test("the first notes screen opens directly to the learner's own notes", async ({ page }) => {
  await page.goto("/today/?internal=1");

  await expect(page.getByRole("heading", { name: "Start with your notes." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try a sample question" })).toHaveCount(0);
  await expect(page.getByLabel("Choose a PDF or notes")).toBeEnabled();
  await expect(page.getByRole("button", { name: /Take photos of your notes/ })).toBeVisible();
  await expect(page.getByText("Or paste your notes")).toBeVisible();
});
