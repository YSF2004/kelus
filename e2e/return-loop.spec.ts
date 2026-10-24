import { expect, test, type Page } from "@playwright/test";
import { answerRun } from "./helpers";

async function playQuickRun(page: Page) {
  await answerRun(page, { explanation: "It depends on how easily buyers can switch.", grade: "Nailed it" });
}

test("answering a topic starts a streak and moves today's goal", async ({ page }) => {
  // The streak and today's goal sit on Progress, so Study stays one decision.
  await page.goto("/today?sample=1");
  await page.locator('nav[aria-label="Revision sections"]').getByRole("button", { name: "Progress", exact: true }).click();
  const stats = page.getByRole("group", { name: "Your path through the course" });
  await expect(stats).toContainText("0/3today");
  // The sample comes with earlier practice and one day off: a rest day keeps its streak alive, and today keeps it.
  await expect(page.getByRole("status").filter({ hasText: /One topic today keeps your \d+-day streak\./ })).toBeVisible();
  const before = Number((await stats.innerText()).match(/(\d+)\s*day streak/)?.[1] ?? 0);

  await page.goto("/today");
  await page.getByRole("button", { name: "Start revising" }).click();
  await playQuickRun(page);

  await page.goto("/today");
  await page.locator('nav[aria-label="Revision sections"]').getByRole("button", { name: "Progress", exact: true }).click();
  await expect(stats).toContainText(new RegExp(`${before + 1}\\s*day streak`));
  await expect(stats).toContainText("1/3today");
  await expect(stats.getByRole("progressbar", { name: "Today’s goal" })).toHaveAttribute("aria-valuenow", "1");
});
