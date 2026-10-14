import { expect, test } from "@playwright/test";

test("the four steps and the student illustration fit on mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const steps = page.locator("[data-revision-step]");
  await expect(steps).toHaveCount(4);
  for (const step of await steps.all()) {
    await step.scrollIntoViewIfNeeded();
    await expect(step).toBeVisible();
  }
  await steps.first().screenshot({ path: testInfo.outputPath("follow-through-mobile.png"), animations: "disabled" });

  const studying = page.locator("section").filter({ has: page.getByRole("heading", { name: "The studying happens here." }) });
  await studying.scrollIntoViewIfNeeded();
  await expect(studying.getByRole("img", { name: "A student revising at a desk" })).toBeVisible();
  await studying.screenshot({ path: testInfo.outputPath("student-study-mobile.png"), animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("home follows one line: notes → question → your words checked → the plan moves", async ({ page }) => {
  await page.goto("/");
  const steps = page.locator("[data-revision-step]");
  await expect(steps.locator("h3")).toHaveText([/Your notes/, /A question from that line/, /Your words, checked/, /Your plan moves/]);
  await steps.last().scrollIntoViewIfNeeded();
  // The same features the product has: a quoted line, a blank from it, the direction check, a plan that reorders.
  await expect(steps.nth(0)).toContainText("partially permeable membrane");
  await expect(steps.nth(1)).toContainText("concentrated");
  await expect(steps.nth(2)).toContainText("Check the direction");
  await expect(steps.nth(3).getByRole("list", { name: "Your plan after this answer" }).locator("li").first()).toContainText("Osmosis");
  await expect(page.getByRole("img", { name: "A student revising at a desk" })).toBeVisible();
});

test("reduced motion shows every step finished at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const steps = page.locator("[data-revision-step]");
  await expect(steps).toHaveCount(4);
  for (const step of await steps.all()) await expect(step).toHaveCSS("opacity", "1");
  await expect(page.getByRole("img", { name: "A student revising at a desk" })).toBeVisible();
});

test("How it works uses the same small icons with its four-step flow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/route/");
  const chapters = page.getByRole("region", { name: "The Kelus revision loop" }).locator("ol > li");
  await expect(chapters).toHaveCount(4);
  await expect(chapters.locator('img[src^="/art/notion-pack/icon-"]')).toHaveCount(4);
  for (const icon of await chapters.locator('img[src^="/art/notion-pack/icon-"]').all()) {
    await expect(icon).toHaveAttribute("alt", "");
  }
  await chapters.first().scrollIntoViewIfNeeded();
  await chapters.first().screenshot({ path: testInfo.outputPath("how-step-mobile.png"), animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
