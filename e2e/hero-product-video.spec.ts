import { expect, test } from "@playwright/test";

test("the homepage shows a recording of the real product at desktop and phone sizes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 375, 414, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const hero = page.locator('[data-hero="product-video"]');
    await expect(hero.locator("h1")).toHaveText("Revise your lessons. Walk into the exam ready.");
    await expect(hero.getByRole("link", { name: "Set up" })).toHaveAttribute("href", /^\/today\/?$/);
    await expect(hero).toContainText("Recorded in Kelus with a demo lecture PDF");
    await expect(hero.locator("video:visible")).toHaveAttribute("poster", /kelus-product-poster/);
    await expect(hero.locator("video:visible source").first()).toHaveAttribute("src", /kelus-product-walkthrough.*\.mp4/);
    await expect(hero.locator("button")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("the video is playable, with native controls and captions", async ({ page }) => {
  await page.goto("/");
  const video = page.locator('[data-hero="product-video"] video:visible');
  await expect(video).toHaveAttribute("controls", "");
  await expect(video.locator("track")).toHaveAttribute("kind", "captions");
  await expect(page.locator('[data-hero="product-video"]')).toContainText("Upload, answer, then see the study plan respond.");
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThan(0);
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
  await page.locator('[data-hero="product-video"]').getByRole("link", { name: "Set up" }).click();
  await expect(page.getByRole("heading", { name: "Start with your notes." })).toBeVisible();
});

test("reduced motion keeps the recording paused until the student chooses play", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const video = page.locator('[data-hero="product-video"] video:visible');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await expect(video).toHaveAttribute("poster", /kelus-product-poster/);
});

test("the revision story still follows the video without a duplicate sample", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#try, .booklet-board")).toHaveCount(0);
  await expect(page.locator("main > section").nth(1).getByRole("heading", { name: "Your notes become the next move." })).toBeVisible();
});
