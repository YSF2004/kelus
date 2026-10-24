import { expect, test } from "@playwright/test";

test("the product keeps a light option: Auto follows the device, Light and Dark stick across a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/today?sample=1");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  const appearance = page.getByRole("radiogroup", { name: "Appearance" }).first();
  await appearance.getByRole("radio", { name: "Light" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(appearance.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("radiogroup", { name: "Appearance" }).first().getByRole("radio", { name: "Auto" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("switching appearance twice leaves the workspace usable and on the final choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/today?sample=1");
  const appearance = page.getByRole("radiogroup", { name: "Appearance" }).first();
  await appearance.getByRole("radio", { name: "Dark" }).click();
  await appearance.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Start revising" })).toBeEnabled();
});
