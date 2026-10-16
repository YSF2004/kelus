import { expect, test, type Page } from "@playwright/test";

async function playQuickRun(page: Page) {
  for (let guard = 0; guard < 6; guard += 1) {
    await expect(page.locator('#run-explain, input[id^="run-gap"]:not([disabled]), [role="group"][aria-label="Choose one"] button:not([disabled])').first()).toBeVisible();
    if (await page.locator("#run-explain").count()) break;
    const gap = page.locator('input[id^="run-gap"]:not([disabled])');
    if (await gap.count()) {
      await gap.fill("zzz");
      await page.getByRole("button", { name: "Check", exact: true }).click();
    } else {
      await page.getByRole("group", { name: "Choose one" }).getByRole("button").first().click();
    }
    await page.getByRole("button", { name: /^(Next|Now say it yourself)/ }).click();
  }
  await page.locator("#run-explain").fill("It depends on how easily buyers can switch.");
  await page.getByRole("button", { name: /Compare with the page/ }).click();
  await page.getByRole("button", { name: /Nailed it/ }).click();
}

test("answering a topic starts a streak and moves today's goal", async ({ page }) => {
  await page.goto("/today?sample=1");
  const stats = page.getByRole("group", { name: "Your path through the course" });
  await expect(stats).toContainText("0/3today");
  // The sample comes with earlier practice and one day off: a rest day keeps its streak alive, and today keeps it.
  await expect(page.getByRole("status").filter({ hasText: /One topic today keeps your \d+-day streak\./ })).toBeVisible();
  const before = Number((await stats.innerText()).match(/(\d+)\s*day streak/)?.[1] ?? 0);

  await page.getByRole("button", { name: /Start this topic/ }).click();
  await playQuickRun(page);

  await page.goto("/today");
  await expect(stats).toContainText(new RegExp(`${before + 1}\\s*day streak`));
  await expect(stats).toContainText("1/3today");
  await expect(stats.getByRole("progressbar", { name: "Today’s goal" })).toHaveAttribute("aria-valuenow", "1");
});
