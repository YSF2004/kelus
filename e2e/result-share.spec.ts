import { expect, test } from "@playwright/test";
import { playQuickRun, startFromPaste } from "./helpers";

const notes = "Cell Biology\n\nOsmosis\nOsmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. In a hypotonic solution a plant cell gains water and becomes turgid because the cell wall pushes back. In a hypertonic solution the cell loses water and becomes plasmolysed.";

test("the end of a session offers its result as a card, and copying it says so for a moment", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await startFromPaste(page, notes);
  await playQuickRun(page, "Water moves across a membrane.", "Partly");
  await page.goto("/session/complete");
  // Done shows the card itself, whole, with one Share button under it.
  const card = page.getByTestId("result-share-card");
  await expect(card).toContainText(/lines? (recalled|practiced) from my notes/);
  await expect(card).toContainText("kelus.me");
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  await page.getByRole("button", { name: "Copy summary" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/^I (recalled|practiced) .* Kelus turns your own notes into questions: http.*\/r\/\?l=/);
  expect(copied).not.toMatch(/membrane|osmosis/i);
  await expect(page.getByRole("button", { name: "Copy summary" })).toBeVisible({ timeout: 4_000 });
});

test("a shared link lands on the classmate's card with a way in; a broken one shows no made-up result", async ({ page }) => {
  await page.goto("/r/?l=6&m=3&t=2&c=11&of=24&s=4");
  await expect(page.getByRole("heading", { name: "They revised from their own notes." })).toBeVisible();
  await expect(page.getByTestId("result-share-card")).toContainText("6/9");
  await expect(page.getByRole("link", { name: /Add your notes/ })).toHaveAttribute("href", /^\/today\/?$/);
  await page.goto("/r/?l=99&m=0&t=1&c=50&of=3&s=1");
  await expect(page.getByTestId("result-share-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Revise from your own notes." })).toBeVisible();
});
