import { expect, test } from "@playwright/test";

test("PDF search entry is readable and opens the real upload flow", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/pdf-to-practice-questions/");
    await expect(page.getByRole("heading", { level: 1, name: "Your PDF is the lesson. Make it the practice too." })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://kelus.me/pdf-to-practice-questions/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole("link", { name: "Add your PDF or notes" }).first().click();
  await expect(page).toHaveURL(/\/today\/?$/);
  await expect(page.getByRole("heading", { name: "Start with your notes." })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
});
