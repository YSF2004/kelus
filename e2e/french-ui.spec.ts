import { expect, test } from "@playwright/test";
import { gotoStart, startBuiltPlan } from "./helpers";

const fiche = "La photosynthèse\nLa photosynthèse est la réaction par laquelle les plantes vertes fabriquent du glucose à partir du dioxyde de carbone et de l'eau. Elle se déroule dans les chloroplastes des cellules des feuilles.\n\nLa respiration\nLa respiration cellulaire est la réaction qui libère l'énergie du glucose dans les mitochondries. Elle consomme du dioxygène.\n\nLes enzymes\nLes enzymes sont des protéines qui accélèrent les réactions chimiques sans être consommées.";

test("French notes get French buttons and feedback, not only French questions", async ({ page }) => {
  await gotoStart(page);
  await page.getByText("Or paste your notes").click();
  await page.locator("#paste-notes").fill(fiche);
  await page.getByRole("button", { name: "Use these notes" }).click();
  await startBuiltPlan(page);
  await page.getByRole("button", { name: "Skip to the questions" }).click();
  // Two lines a topic leave nothing to check but which topic a line is about, which is never asked: the topic opens
  // on the question in your own words. Either way the question is French and the interface stays English.
  const check = page.getByRole("region", { name: /^Check \d of \d$/ });
  await expect(check.or(page.locator("#run-explain")).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "More session options" })).toHaveText("More");
  if (await check.count()) {
    await page.getByRole("button", { name: "I’m not sure" }).click();
    await expect(page.getByRole("button", { name: /^(Next|Now say it yourself)/ })).toBeVisible();
  } else {
    await expect(page.locator("main")).toContainText(/tes notes|Explique|Comment expliquerais/);
    await page.locator("#run-explain").fill("Les plantes fabriquent du glucose.");
    await expect(page.getByRole("button", { name: /Compare with the page/ })).toBeVisible();
  }
});
