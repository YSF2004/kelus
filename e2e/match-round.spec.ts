import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { startFromFile } from "./helpers";

// After a block of three topics, a quick match: tap a topic, then its line from the notes. A wrong line keeps the
// topic picked; the round counts the slips and changes no result.
test("the done page offers a quick match on the topics just practised", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await startFromFile(page, { name: "biology-ch7-cell-transport.pdf", mimeType: "application/pdf", buffer: readFileSync("tests/fixtures/course-pdfs/biology-ch7-cell-transport.pdf") });
  for (let i = 0; i < 120 && !/complete/.test(page.url()); i++) {
    await page.waitForTimeout(250);
    const skip = page.getByRole("button", { name: "Skip to the questions" }); if (await skip.count()) { await skip.click(); continue; }
    const choices = page.locator("[aria-label='Choose one'] button:not([disabled])");
    if (await choices.count()) { await choices.first().click(); const next = page.getByRole("button", { name: /^(Next|Now say it yourself)/ }).first(); if (await next.count()) await next.click(); continue; }
    const explain = page.locator("#run-explain");
    if (await explain.count() && await explain.isEditable().catch(() => false) && !(await explain.inputValue())) { await explain.fill("Particles move from high to low concentration across a membrane."); const check = page.getByRole("button", { name: /^(Compare|Check)/ }).first(); if (await check.count()) await check.click(); continue; }
    const grade = page.getByRole("button", { name: /Nailed it|Got most|Partly/ }).first(); if (await grade.count()) { await grade.click(); continue; }
    const more = page.getByRole("button", { name: /^(Continue|Next|Done|Finish|See)/ }).first(); if (await more.count()) { await more.click(); continue; }
    const gap = page.locator("input[type=text]").first(); if (await gap.count() && await gap.isEditable().catch(() => false)) { await gap.fill("x"); await page.keyboard.press("Enter"); }
  }
  const round = page.getByRole("region", { name: "Quick match" });
  await expect(round).toBeVisible();
  const lines = round.getByRole("list", { name: "Lines from your notes" }).getByRole("button");
  await expect(lines).toHaveCount(3);
  // No line names its own topic: the match is recall.
  for (const text of await lines.allTextContents()) expect(text).not.toMatch(/Diffusion|Osmosis|Active transport/);
  const key: Record<string, RegExp> = { Diffusion: /net movement of particles/, Osmosis: /water molecules/, "Active transport": /against a concentration gradient/ };
  const topics = round.getByRole("list", { name: "Topics" }).getByRole("button");
  const first = (await topics.first().textContent())!.trim();
  await topics.first().click();
  const texts = await lines.allTextContents();
  await lines.nth(texts.findIndex((t) => !key[first].test(t))).click();
  await expect(topics.first()).toHaveAttribute("aria-pressed", "true");
  for (let n = 0; n < 3; n++) {
    if (await topics.nth(n).isDisabled()) continue;
    const name = (await topics.nth(n).textContent())!.trim();
    if ((await topics.nth(n).getAttribute("aria-pressed")) !== "true") await topics.nth(n).click();
    await lines.nth((await lines.allTextContents()).findIndex((t) => key[name].test(t))).click();
  }
  await expect(round).toContainText("All 3 matched, 1 slip on the way.");
});
