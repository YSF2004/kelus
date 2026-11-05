import { expect, test } from "@playwright/test";
import { startFromPaste } from "./helpers";

const notes = `# Microeconomics

## Price elasticity of demand
Price elasticity of demand measures how strongly the quantity demanded responds to a change in price. Elastic demand means that quantity demanded changes by a larger percentage than price. Inelastic demand means that quantity demanded changes by a smaller percentage than price. Close substitutes make demand more elastic because buyers can switch products. Necessities tend to have inelastic demand because buyers have fewer alternatives.

## Tax incidence
Tax incidence describes how a tax burden is divided between buyers and sellers. The less elastic side of a market bears more of the tax burden. Buyers with inelastic demand cannot easily reduce purchases when prices rise. Sellers with elastic supply can move resources to other markets. A tax reduces the quantity traded and creates a deadweight loss.`;

test("a learner's feedback, source jump and unfinished explanation survive a reload", async ({ page }) => {
  await startFromPaste(page, notes);
  const check = page.locator('section[aria-label^="Check "]');
  const prompt = await check.locator("h1").innerText();
  await check.getByRole("button", { name: "I’m not sure", exact: true }).click();
  await expect(check.getByTestId("source-evidence-jump")).toBeVisible();
  await page.reload();
  await expect(check.locator("h1")).toHaveText(prompt);
  await expect(page.getByTestId("status-study-save")).toContainText("Resumed where you left off");
  await expect(check.getByRole("button", { name: "I’m not sure", exact: true })).toHaveCount(0);
  await check.getByTestId("source-evidence-jump").click();
  await expect(page.locator('[data-source-quote="first"]')).toBeVisible();
  await page.getByRole("button", { name: "Close your notes", exact: true }).click();

  // Finish the remaining instant checks, without depending on the generated answer order.
  for (let count = 0; count < 3 && await check.count(); count += 1) {
    const unsure = check.getByRole("button", { name: "I’m not sure", exact: true });
    if (await unsure.isVisible()) await unsure.click();
    await check.getByRole("button", { name: /^(Next question|Next(?! section)|Now say it yourself)$/ }).click();
  }
  const explanation = page.locator("#run-explain");
  const answer = "The side with fewer alternatives cannot change its behaviour as easily.";
  await expect(explanation).toBeVisible();
  await explanation.fill(answer);
  await expect.poll(() => page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith("kelus:study-draft:v1:"));
    return keys.some((key) => JSON.parse(localStorage.getItem(key) ?? "{}").draft?.explained === "The side with fewer alternatives cannot change its behaviour as easily.");
  })).toBe(true);
  await page.reload();
  await expect(explanation).toHaveValue(answer);
  await page.getByRole("button", { name: "Compare with the page", exact: true }).click();
  await expect(page.getByTestId("text-explanation-evidence")).toBeVisible();
  await page.getByTestId("button-show-explanation-source").click();
  await expect(page.locator('[data-source-quote="first"]')).toBeVisible();
});
