import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`what is due now is the one raised card, and the rest stays flat, at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/today?sample=1");
    await expect(page.locator("#today-title")).toBeVisible();

    // The study plan leads with one card, as the homepage does: the topic due now, raised, with the green key.
    const lead = page.locator('[data-block="today-lead"]');
    // The due topic is intentionally raised without a border; the quiet shadow separates it from the page.
    await expect(lead).not.toHaveCSS("box-shadow", "none");
    await expect(lead).toHaveCSS("border-top-width", "0px");
    await expect(page.locator('[data-action="start-topic"]')).toBeVisible();
    await page.screenshot({ path: `/tmp/kelus-quiet-today-${viewport.width}.png`, fullPage: true });

    await page.goto("/today?section=map");
    await expect(page.locator(".surface-map")).toBeVisible();
    await expect(page.getByRole("group", { name: "Sample course progress" }).locator("ul li").first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await page.screenshot({ path: `/tmp/kelus-quiet-topics-${viewport.width}.png`, fullPage: true });

    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(horizontalOverflow).toBe(false);
  });
}
