import { expect, test } from "@playwright/test";

test("the public homepage stays in its original light palette on a dark device", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await expect(page.locator("body")).toHaveCSS("color-scheme", "light");
  await expect(page.locator(".home")).toHaveCSS("filter", "none");
  await expect(page.locator("body")).not.toHaveCSS("background-color", "rgb(18, 21, 20)");
});

test("the product keeps direct light and dark choices across a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/today?sample=1");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light appearance" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Switch to dark appearance" })).toBeVisible();
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark appearance" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("switching appearance twice leaves the workspace usable and on the final choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/today?sample=1");
  await page.getByRole("button", { name: "Switch to dark appearance" }).click();
  await page.getByRole("button", { name: "Switch to light appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Start this topic" })).toBeEnabled();
});
