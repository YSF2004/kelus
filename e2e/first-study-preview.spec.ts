import { expect, test } from "@playwright/test";

test("the first-use screen goes straight to the learner's own notes", async ({ page }) => {
  await page.goto("/today/?internal=1");
  await expect(page.getByRole("button", { name: "Try a sample question" })).toHaveCount(0);
  await expect(page.getByLabel("Choose a PDF or notes")).toBeEnabled();
});
