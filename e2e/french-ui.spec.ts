import { expect, test } from "@playwright/test";
import { gotoStart, startBuiltPlan } from "./helpers";

const fiche = "La photosynthèse\nLa photosynthèse est la réaction par laquelle les plantes vertes fabriquent du glucose à partir du dioxyde de carbone et de l'eau. Elle se déroule dans les chloroplastes des cellules des feuilles.\n\nLa respiration\nLa respiration cellulaire est la réaction qui libère l'énergie du glucose dans les mitochondries. Elle consomme du dioxygène.\n\nLes enzymes\nLes enzymes sont des protéines qui accélèrent les réactions chimiques sans être consommées.";

test("French notes get French buttons and feedback, not only French questions", async ({ page }) => {
  await gotoStart(page);
  await page.getByText("Or paste your notes").click();
  await page.locator("#paste-notes").fill(fiche);
  await page.getByRole("button", { name: "Use these notes" }).click();
  await startBuiltPlan(page);
  // The reading is offered in French beside the first question, and skipped back from in French.
  await page.getByRole("button", { name: "Lire la source d’abord" }).click();
  await page.getByRole("button", { name: "Passer aux questions" }).click();
  await expect(page.getByText(/^Sujet \d sur \d$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Je ne sais pas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "More session options" })).toHaveText("Plus");
  await page.getByRole("button", { name: "Je ne sais pas" }).click();
  await expect(page.getByRole("button", { name: /^(Suivant|À toi de l’expliquer)/ })).toBeVisible();
});
