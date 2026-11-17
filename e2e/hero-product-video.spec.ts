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

test("the hero's one action animates as it opens the product", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const action = page.locator('[data-hero="leitner"]').getByRole("link", { name: "Add your notes" });
  const opacityOnNavigate = action.evaluate((element) => new Promise<number>((resolve) => {
    const observer = new MutationObserver(() => {
      if (!element.classList.contains("is-navigating")) return;
      observer.disconnect();
      requestAnimationFrame(() => resolve(Number(getComputedStyle(element).opacity)));
    });
    observer.observe(element, { attributes: true, attributeFilter: ["class"] });
  }));
  await action.click();
  expect(await opacityOnNavigate).toBeLessThan(1);
  await expect(page).toHaveURL(/\/today\/?$/);
});

test("reduced motion shows every question and the checked answer at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const cards = page.locator('[data-hero="leitner"] figure ol > li');
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) await expect(card).toHaveCSS("opacity", "1");
});

test("the homepage scroll reveal hydrates without a motion mismatch", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydration|didn.t match/i.test(message.text())) hydrationErrors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator('[data-revision-step="01"]')).toHaveCSS("opacity", "1");
  expect(hydrationErrors).toEqual([]);
});

test("the revision story still follows the hero without a duplicate sample", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#try, .booklet-board")).toHaveCount(0);
  await expect(page.locator("main > section").nth(1).getByRole("heading", { name: "One line from your notes, followed all the way." })).toBeVisible();
});

test("the study illustration is large and centered on phone and desktop", async ({ page }) => {
  for (const { viewport, maxWidth, minWidth } of [
    { viewport: { width: 390, height: 844 }, maxWidth: 352, minWidth: 320 },
    { viewport: { width: 800, height: 900 }, maxWidth: 448, minWidth: 320 },
    { viewport: { width: 1024, height: 900 }, maxWidth: 448, minWidth: 440 },
    { viewport: { width: 1440, height: 900 }, maxWidth: 448, minWidth: 440 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const illustration = page.getByRole("img", { name: "A student working through a problem" });
    await illustration.scrollIntoViewIfNeeded();
    await expect(illustration).toBeVisible();
    const bounds = await illustration.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeLessThanOrEqual(maxWidth + 1);
    expect(bounds!.width).toBeGreaterThanOrEqual(minWidth);
    expect(bounds!.height).toBeLessThanOrEqual(340);

    const art = illustration.locator("xpath=ancestor::div[contains(@class, 'studyArt')][1]");
    const artBounds = await art.boundingBox();
    expect(artBounds).not.toBeNull();
    const imageCenter = bounds!.y + bounds!.height / 2;
    const artCenter = artBounds!.y + artBounds!.height / 2;
    expect(Math.abs(imageCenter - artCenter)).toBeLessThanOrEqual(3);
  }
});
