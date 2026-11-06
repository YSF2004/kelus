import { test, expect } from "@playwright/test";

test("Today is one booklet page — topic title, no planner chrome", async ({ page }) => {
  await page.goto("/today?sample=1");
  await expect(page.locator("#today-title")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toHaveCount(0);
  await expect(page.getByText("Next", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Next stops", { exact: true })).toHaveCount(0);
  await expect(page.locator("details[aria-label='Practice evidence']")).toHaveCount(0);
  await expect(page.locator(".today-plan-list")).toHaveCount(0);
  await expect(page.locator(".today-evidence-disclosure")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Start this topic/ })).toBeVisible();
});

test("topic index and topic detail show the same derived practice mastery", async ({ page }) => {
  await page.goto("/today?sample=1");
  await page.getByRole("navigation", { name: "Revision sections" }).getByRole("button", { name: "Progress" }).click();
  await page.getByRole("link", { name: "Topics and exam check" }).first().click();
  // The step on the path, not the "Start here" card above it.
  const topic = page.getByRole("list", { name: "Topics, in the order of your notes" }).locator(".index-toc-row").filter({ hasText: "Elasticity" });
  // A percentage once there are three answers, the number of tries before that: the same on both screens.
  const indexMastery = (await topic.locator(".index-toc-meta").innerText()).match(/\d+%|\d+ tr(?:y|ies)/)?.[0];
  expect(indexMastery).toBeTruthy();
  await expect(page.getByRole("region", { name: "Next study step" })).toContainText("Elasticity");
  await expect(topic.locator(".index-toc-meta")).toContainText("Built-in example");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await topic.click();
  await expect(page.getByRole("heading", { name: "Elasticity" })).toBeVisible();
  await expect(page.getByTestId("topic-standing")).toContainText(indexMastery!);
});
