import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { playQuickRun, startFromFile } from "./helpers";

// After a block of three topics, a quick match: tap a topic, then its line from the notes. A wrong line keeps the
// topic picked; the round counts the slips and changes no result.
test("the done page offers a quick match on the topics just practised", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await startFromFile(page, { name: "biology-ch7-cell-transport.pdf", mimeType: "application/pdf", buffer: readFileSync("tests/fixtures/course-pdfs/biology-ch7-cell-transport.pdf") });
  // A first session is one topic; the match needs a block of three, so it comes after the second session.
  const play = async () => {
    for (let topic = 0; topic < 5; topic += 1) {
      await playQuickRun(page, "Particles move from high to low concentration across a membrane.", "Nailed it");
      await page.getByRole("button", { name: /^(Continue to|Finish session|See how it went)/ }).first().click();
      const done = page.getByRole("heading", { name: "Done.", exact: true });
      const nextPrompt = page.getByRole("region", { name: "Read it first" })
        .or(page.locator('section[aria-label^="Check "]'))
        .or(page.locator("#run-explain"));
      await done.or(nextPrompt).first().waitFor({ timeout: 30_000 });
      if (await done.isVisible()) break;
    }
    await expect(page).toHaveURL(/\/session\/complete/);
  };
  await play();
  await page.goto("/today");
  await page.locator('button[data-action="start-topic"]').click();
  await expect(page).toHaveURL(/\/session/);
  await play();
  // The round lives in the folded part of the done page.
  await page.getByText("More from this session").click();
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
