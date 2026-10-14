import { expect, test } from "@playwright/test";

test("How it works shows the plan saying why, from the student's own last answer", async ({ page }) => {
  await page.goto("/route/");
  const route = page.locator("figure").nth(2);
  await route.scrollIntoViewIfNeeded();
  await expect(route).toContainText("Osmosis");
  await expect(route).toContainText("Last time, 3 days ago, it came out partly right.");
  await expect(page.getByRole("button", { name: "Replay how the study route changes" })).toHaveCount(0);
});

test("reduced motion presents every step finished", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/route/");
  for (const row of await page.locator("figure li").all()) await expect(row).toHaveCSS("opacity", "1");
  await expect(page.getByRole("button", { name: "Replay how the study route changes" })).toHaveCount(0);
});
