import { test, expect } from "@playwright/test";

test("homepage uses editorial type around the real product recording", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator('[data-hero="product-video"]');
  await expect(hero.locator("h1")).toHaveCSS("font-family", /Literata/i);
  await expect(hero.locator("p").first()).toHaveCSS("font-family", /Inter/i);
  await expect(hero.locator("figcaption")).toHaveCount(0);
  await expect(hero.locator("video:visible")).not.toHaveAttribute("controls", "");
});

test("How it works uses the shared Kelus canvas on desktop and mobile", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/route/");
    const canvas = page.locator("main > div").first();
    await expect(canvas).toHaveCSS("background-color", "rgb(255, 255, 255)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("How it works tells one course story and actions stay green", async ({ page }) => {
  await page.goto("/route/");
  await expect(page.getByRole("group", { name: "Choose an example course" })).toHaveCount(0);
  await expect(page.locator('figure').first()).toContainText("Cell Transport");
  await expect(page.locator('figure').nth(1)).toContainText("a plant cell in a hypotonic solution");
  await expect(page.locator('figure').nth(2)).toContainText("Osmosis");
  const setupActions = page.getByRole("link", { name: "Set up my course" });
  await expect(setupActions).toHaveCount(2);
  await expect(setupActions.first()).toHaveCSS("background-color", "rgb(31, 107, 69)");
  await expect(setupActions.first()).toHaveCSS("border-radius", "8px");
  await expect(setupActions.first()).toHaveCSS("min-height", "48px");
  await expect(setupActions.first()).toHaveAttribute("href", "/today/");
  await expect(setupActions.last()).toHaveCSS("border-radius", "8px");
  for (const width of [320, 375, 414, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}px`).toBe(true);
  }
  for (const section of await page.locator('section[class*="story"] li, section[class*="principle"], footer[class*="final"]').all()) {
    await section.scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(700);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/how-it-works-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/how-it-works-mobile.png", fullPage: true });
});

test("one pair of faces on every page: Literata headings, Inter text", async ({ page }) => {
  for (const [path, heading] of [["/", "#home-hero-title"], ["/route/", "#how-title"], ["/pricing/", ".pricing-page h1"]]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(heading)).toHaveCSS("font-family", /Literata/i);
    await expect(page.locator('[data-marketing] p').first()).toHaveCSS("font-family", /Inter/i);
    await expect(page.locator('.site-header a').first()).toHaveCSS("font-family", /Inter/i);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto("/");
  await page.locator('#home-hero-title').waitFor();
  await page.getByRole("link", { name: "Add your notes" }).first().click();
  await expect(page.locator('[data-marketing]')).toHaveCount(0);
  // The product is its own instrument: Geist for text and titles.
  await expect(page.locator("body")).toHaveCSS("font-family", /Geist/i);
});
