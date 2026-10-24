import { test, expect } from "@playwright/test";
import { openTopics } from "./helpers";

test("Today is one booklet page — topic title, no planner chrome", async ({ page }) => {
  await page.goto("/today?sample=1");
  await expect(page.locator("#today-title")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toHaveCount(0);
  await expect(page.getByText("Next", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Next stops", { exact: true })).toHaveCount(0);
  await expect(page.locator("details[aria-label='Practice evidence']")).toHaveCount(0);
  await expect(page.locator(".today-plan-list")).toHaveCount(0);
  await expect(page.locator(".today-evidence-disclosure")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start revising" })).toBeVisible();
});

test("topic index and topic detail show the same derived practice mastery", async ({ page }) => {
  await page.goto("/today?sample=1");
  await openTopics(page);
  // The step on the path, not the "Start here" card above it.
  const topic = page.getByRole("list", { name: "Topics, in the order of your notes" }).locator(".index-toc-row").filter({ hasText: "Elasticity" });
  // A percentage once there are three answers, the number of tries before that: the same on both screens.
  const indexMastery = (await topic.locator(".index-toc-meta").innerText()).match(/\d+%|\d+ tr(?:y|ies)/)?.[0];
  expect(indexMastery).toBeTruthy();
  await topic.click();
  await expect(page.getByRole("heading", { name: "Elasticity" })).toBeVisible();
  await expect(page.getByTestId("topic-standing")).toContainText(indexMastery!);
});
