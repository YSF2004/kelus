import { sectionsNav } from "./helpers";
import { expect, test } from "@playwright/test";

test("setup fits mobile without a duplicate homepage preview", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.locator(".booklet-board")).toHaveCount(0);
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Start with your notes." })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("hero content is visible before hydration", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.locator("h1").textContent()).toBe("Turn your notes into practice questions.");
  await expect(page.locator("[class*=notion]")).toHaveCount(0);
  await expect(page.locator(".site-header")).toHaveCSS("box-shadow", "none");
  await expect(page.locator(".booklet-board")).toHaveCount(0);
  await context.close();
});

test("hero and revision steps work on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Turn your notes into practice questions");

  await expect(page.locator(".booklet-board")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "One line from your notes, followed all the way." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("a direct completion URL never invents a completed session", async ({ page }) => {
  await page.goto("/session/complete?id=missing-session");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nothing finished yet.");
  await expect(page.getByRole("link", { name: /Back to your plan/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kelus home" })).toBeVisible();
  await expect(page.getByText("estimated readiness", { exact: true })).toHaveCount(0);
});

test("the learning story stays continuous at every supported mobile width", async ({ page }) => {
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/route");
    const stages = page.getByRole("region", { name: "The Kelus revision loop" }).locator("ol > li");
    await expect(stages).toHaveCount(4);
    for (const stage of await stages.all()) {
      await stage.scrollIntoViewIfNeeded();
      await expect(stage).toBeVisible();
      await expect(stage.getByRole("heading", { level: 2 })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("a student can follow the study plan into topics and open one", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/today/?sample=1");
  await expect(page.getByRole("heading", { name: "Elasticity" })).toBeVisible();
  await expect(page.getByLabel("Why this topic is first")).toContainText("last answers here were shaky");
  await expect(page.getByRole("button", { name: /Start this topic/ })).toBeVisible();

  await page.getByRole("button", { name: "Topics" }).click();
  await expect(page.getByRole("heading", { name: "Topics" })).toBeVisible();
  // The route's first stop is marked in the source-order topic list.
  await page.locator(".index-toc-row", { hasText: "Start here" }).click();
  await expect(page).toHaveURL(/\/concept\/?\?id=c-elasticity/);
  await expect(page.getByRole("heading", { name: "Elasticity" })).toBeVisible();
  await expect(page.getByTestId("topic-standing")).toContainText("Needs work");
  await expect(page.getByRole("button", { name: /Study it again/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Where you are" }).getByRole("link")).toBeVisible();
});

test("the course workspace stays legible across its sections and returns home", async ({ page }) => {
  await page.goto("/today/?sample=1");
  await expect(page.locator("#today-title")).toHaveText("Elasticity");
  // The workspace uses the pale paper surface; cards and navigation carry the stronger contrast.
  await expect(page.locator(".studio-main")).toHaveCSS("background-color", "rgb(241, 244, 239)");
  await expect(page.locator('[data-block="course-title"]')).toHaveText("Microeconomics");

  const sections = sectionsNav(page);
  await sections.getByRole("button", { name: "Materials" }).click();
  await expect(page.getByRole("heading", { name: "Materials" })).toBeVisible();
  await expect(sections.getByRole("button", { name: "Materials" })).toHaveAttribute("aria-pressed", "true");
  await expect(sections.getByRole("button", { name: "Materials" })).toHaveCSS("box-shadow", /0px 0px 0px 1px/);
  await expect(page.locator(".material-shelf h2")).toHaveCSS("color", "rgb(14, 21, 18)");
  await sections.getByRole("button", { name: "Topics" }).click();
  await expect(page.getByRole("heading", { name: "Topics" })).toBeVisible();
  await expect(sections.getByRole("button", { name: "Topics" })).toHaveAttribute("aria-pressed", "true");
  await expect(sections.getByRole("button", { name: "Topics" })).toHaveCSS("box-shadow", /0px 0px 0px 1px/);
  await expect(page.locator(".index-toc-row", { hasText: "Start here" })).toContainText("Elasticity");

  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(sections.getByRole("button", { name: "Study plan" })).toBeVisible();
  }

  await page.getByRole("link", { name: "Kelus home" }).click();
  await expect(page).toHaveURL(/\/$/);
});
