import { expect, test } from "@playwright/test";
import { passOwnWords, gotoStart, skipReading, startBuiltPlan } from "./helpers";

test("a missed line can be seen circled on the student's own PDF page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoStart(page);
  await page.locator('input[type="file"]').first().setInputFiles("tests/fixtures/course-pdfs/biology-ch7-cell-transport.pdf");
  await startBuiltPlan(page);
  await skipReading(page);
  await passOwnWords(page);
  // Answer until one is missed, then open it on the page.
  for (let guard = 0; guard < 4; guard += 1) {
    const gap = page.locator('input[id^="run-gap"]:not([disabled])');
    if (await gap.count()) { await gap.fill("zzz"); await page.getByRole("button", { name: "Check", exact: true }).click(); }
    else await page.getByRole("group", { name: "Choose one" }).getByRole("button").nth(1).click();
    const see = page.getByRole("button", { name: "See it on your page" });
    if (await see.count()) { await see.click(); break; }
    await page.getByRole("button", { name: /^(Next|Now say it yourself)/ }).click();
  }
  await expect(page.locator(".core-source-marker").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".core-source-loop")).toHaveCount(1);
  await expect(page.getByRole("status").filter({ hasText: /The line is marked on page 1/ })).toHaveCount(1);
});
