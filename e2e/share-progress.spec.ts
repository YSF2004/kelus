import { expect, test } from "@playwright/test";
import { playQuickRun, startFromPaste } from "./helpers";

const notes = "Osmosis\nOsmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. In a hypotonic solution a plant cell gains water and becomes turgid because the cell wall pushes back.\n\nDiffusion\nDiffusion is the net movement of particles from a region of higher concentration to a region of lower concentration.";

test("today's progress can be shared from the sidebar, with today's numbers, before any session ends there", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto("/today");
  // Nothing studied today: nothing to share, so no card.
  await expect(page.getByRole("button", { name: /Share your progress/ })).toHaveCount(0);
  await startFromPaste(page, notes);
  await playQuickRun(page, "Water moves across a membrane toward more solute.", "Partly");
  await page.goto("/today");
  const card = page.getByRole("button", { name: /Share your progress/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText(/recalled today|today’s revision/);
  await card.click();
  const sheet = page.getByRole("dialog", { name: "Share your progress" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("result-share-card")).toContainText("Every question came from my own notes.");
  await expect(sheet.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("on a phone, Progress has the share button instead of the sidebar card", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startFromPaste(page, notes);
  await playQuickRun(page, "Water moves toward more solute.", "Partly");
  await page.goto("/today?section=progress");
  await page.getByRole("button", { name: /Share today’s progress/ }).click();
  await expect(page.getByRole("dialog", { name: "Share your progress" })).toBeVisible();
});
