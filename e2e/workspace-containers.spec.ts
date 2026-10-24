import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`ordinary study content stays unboxed at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/today?sample=1");
    await expect(page.locator("#today-title")).toBeVisible();

    const lead = page.locator('[data-block="today-lead"]');
    await expect(lead).toHaveCSS("border-top-style", "none");
    await expect(lead).toHaveCSS("border-right-style", "none");
    await expect(lead).toHaveCSS("box-shadow", "none");
    await expect(lead).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator('[data-block="today-page-folio"]')).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator('[data-action="start-topic"]')).toBeVisible();
    await page.screenshot({ path: `/tmp/kelus-quiet-today-${viewport.width}.png`, fullPage: true });

    await page.goto("/today?section=map");
    await expect(page.locator(".surface-map")).toBeVisible();
    await expect(page.getByRole("group", { name: "Where you are" }).locator("ul li").first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await page.screenshot({ path: `/tmp/kelus-quiet-topics-${viewport.width}.png`, fullPage: true });

    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(horizontalOverflow).toBe(false);
  });
}
