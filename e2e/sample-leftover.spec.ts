import { expect, test } from "@playwright/test";
import { playQuickRun, sectionsNav } from "./helpers";

test("the built-in sample shows only in the session that opened it; a later visit starts with your own notes", async ({ context }) => {
  const first = await context.newPage();
  await first.goto("/today?sample=1");
  await expect(first.locator("#today-title")).toBeVisible();
  await expect(first.locator('[data-block="course-title"]')).toHaveText("Microeconomics");
  // The top bar is controls only: the course is named by the page title, not again above it.
  await expect(first.locator(".studio-topbar")).not.toContainText("Microeconomics");
  await first.close();

  // A new tab is a new session: the sample saved on this device is not your course.
  const later = await context.newPage();
  await later.goto("/today", { waitUntil: "networkidle" });
  await expect(later.getByRole("heading", { name: "Start with your notes." })).toBeVisible();
  await expect(later.getByText("Microeconomics")).toHaveCount(0);
});

test("sample activity stays identified through progress, materials, the study session and completion", async ({ page }) => {
  await page.goto("/today?sample=1");
  await expect(page.locator("#today-title")).toBeVisible();

  const notice = page.getByRole("note", { name: "Sample course notice" });
  await expect(notice).toContainText("built-in example");
  await expect(notice.getByRole("link", { name: "Use my own notes" })).toBeVisible();
  await expect(page.getByLabel("Why this topic is first")).toContainText("Example history");

  await sectionsNav(page).getByRole("button", { name: "Progress", exact: true }).click();
  await expect(notice).toBeVisible();
  await expect(page.locator("#progress-headline")).toContainText("example");
  await expect(page.getByText("Illustrative sample activity, not your study history or a grade prediction.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recall in the example" })).toBeVisible();

  await sectionsNav(page).getByRole("button", { name: "Materials", exact: true }).click();
  await expect(notice).toBeVisible();
  await expect(page.getByRole("heading", { name: /Example source/ })).toBeVisible();

  await sectionsNav(page).getByRole("button", { name: "Study plan", exact: true }).click();
  await page.getByRole("button", { name: /^Start(?: this topic)?$/ }).click();
  await expect(page).toHaveURL(/\/session/);
  await expect(page.getByRole("note", { name: "Sample course notice" })).toBeVisible();

  for (let topic = 0; topic < 6; topic += 1) {
    await playQuickRun(page, "This is an example explanation from the sample course.", "Partly");
    const goalDialog = page.getByRole("dialog");
    const finishAfterGoal = goalDialog.getByRole("button", { name: "Finish session", exact: true });
    if (await finishAfterGoal.isVisible()) {
      await finishAfterGoal.click();
      break;
    }
    const next = page.getByRole("button", { name: /^Continue to / });
    const finish = page.getByRole("button", { name: /^(?:Finish block|Finish session)$/ });
    await next.or(finish).first().waitFor();
    if (await next.count()) {
      await next.click();
    } else {
      await finish.click();
      break;
    }
  }

  await expect(page).toHaveURL(/\/session\/complete/);
  await expect(page.getByRole("heading", { name: "Sample complete." })).toBeVisible();
  await expect(page.getByText("Example answers are saved to this sample course only.")).toBeVisible();
  await expect(page.getByRole("note", { name: "Sample course notice" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Add tomorrow to calendar/ })).toHaveCount(0);
});
