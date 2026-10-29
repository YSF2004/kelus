import { expect, test } from "@playwright/test";

// The search page for "pdf to flashcards": real Kelus output on an open PDF, one clear action, no WCAG A/AA issues.
test("Lecture slides page shows real cards beside their slides, starts the product, and is accessible", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/lecture-slides-to-flashcards/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lecture slides to flashcards, from your own deck.");
    await expect(page.getByText("longer", { exact: true })).toBeVisible();
    await expect(page.getByText(/Slide 4/).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const faq = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? "{}");
  expect(faq["@type"]).toBe("FAQPage");
  // The same axe run as e2e/a11y.spec.ts.
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const violations = await page.evaluate(async () => {
    const result = await (window as unknown as { axe: { run: (c: object) => Promise<{ violations: Array<{ id: string; nodes: Array<{ target: string[] }> }> }> } }).axe.run({ runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] });
    return result.violations.map((violation) => `${violation.id}: ${violation.nodes.slice(0, 3).map((node) => node.target.join(" ")).join(" | ")}`);
  });
  expect(violations).toEqual([]);
  await page.getByRole("link", { name: "Turn slides into flashcards" }).first().click();
  await expect(page).toHaveURL(/\/today\/?$/);
});
