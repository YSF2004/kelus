import { expect, test } from "@playwright/test";

test("the optional first-use example explains every answer without creating learner data", async ({ page }) => {
  await page.goto("/today/?internal=1");
  const before = await page.evaluate(() => ({ ...window.localStorage }));
  await page.getByRole("button", { name: "Try a sample question" }).click();
  await expect(page.getByRole("heading", { name: "From the built-in Microeconomics example" })).toBeVisible();
  const source = page.getByRole("blockquote", { name: "Sample source passage, built-in example" });
  await page.getByRole("button", { name: "Not sure", exact: true }).click();
  await expect(page.getByText("Let’s check the source", { exact: true })).toBeVisible();
  await expect(source).toBeVisible();
  await expect(source.locator("mark")).toContainText("Close substitutes");
  await page.getByRole("button", { name: "True", exact: true }).click();
  await expect(page.getByText("Compare with the source", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "True", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "False", exact: true }).click();
  await expect(page.getByText("That matches the source", { exact: true })).toBeVisible();
  await expect(page.getByText("Why", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close sample" }).click();
  await expect(page.getByRole("button", { name: "Try a sample question" })).toBeVisible();
  expect(await page.evaluate(() => ({ ...window.localStorage }))).toEqual(before);
  await expect(page.getByLabel("Choose a PDF or notes")).toBeEnabled();
});
