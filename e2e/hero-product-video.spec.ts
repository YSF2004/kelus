import { test, expect } from "@playwright/test";

test("the hero says what Kelus does and shows lines of a page becoming questions, at desktop and phone sizes", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const hero = page.locator('[data-hero="leitner"]');
    await expect(hero.getByRole("heading", { level: 1 })).toHaveText(/Turn your notes into practice questions\./);
    await expect(hero.getByRole("figure", { name: /three lines of a page become questions/ })).toBeVisible();
    await expect(hero.getByText("Example course", { exact: true })).toBeVisible();
    await expect(hero.locator("video")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("the hero's one action opens the product", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-hero="leitner"]').getByRole("link", { name: "Add your notes" }).click();
  await expect(page).toHaveURL(/\/today\/?$/);
});

test("reduced motion shows every question and the checked answer at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const cards = page.locator('[data-hero="leitner"] figure ol > li');
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) await expect(card).toHaveCSS("opacity", "1");
});

test("the revision story still follows the hero without a duplicate sample", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#try, .booklet-board")).toHaveCount(0);
  await expect(page.locator("main > section").nth(1).getByRole("heading", { name: "One line from your notes, followed all the way." })).toBeVisible();
});
