import { expect, test } from "@playwright/test";
import { playQuickRun, startFromPaste } from "./helpers";

const notes = `# Osmosis
Osmosis is the movement of water across a selectively permeable membrane from a region of low solute concentration to a region of high solute concentration. Water moves toward the side with more solute because the solute lowers the water potential there.

# Enzymes
Enzymes are biological catalysts, almost always proteins, that speed up reactions by lowering the activation energy. Each enzyme has an active site whose shape fits a specific substrate, which is why enzymes are specific.`;

test("the result is one card: verdict with its evidence, what to remember, one next step", async ({ page }) => {
  await startFromPaste(page, notes);
  await playQuickRun(page, "It moves water toward more solute.", "Nailed it");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^(Solid pass|Partly there|Needs another attempt)\.$/);
  // The evidence is said once: as tiles to the eye, as one sentence to a screen reader.
  await expect(page.locator(".sr-only", { hasText: /\d of \d checks? right|\d of \d key ideas in your explanation|not enough in your answer to measure yet/ })).toHaveCount(1);
  await expect(page.getByText(/^checks? right$|^key ideas said$/).first()).toBeVisible();
  // When it comes back is said once, at the head of the topic's lines.
  await expect(page.getByRole("region", { name: /when its lines come back$/ })).toContainText(/Back (?:later|tomorrow|in|next)|When its/);
  await expect(page.getByText("comes back", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Quick checks", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^(?:Worth remembering|The line you missed|A line you missed|One more line from your notes)/)).toBeVisible();

  // The next step is on screen without scrolling, on a phone too.
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 780 }]) {
    await page.setViewportSize(viewport);
    // A first session is one topic, so its one next step is to finish the block.
    const next = page.getByRole("button", { name: /^(Continue to |Finish session)/i });
    await expect(next).toBeVisible();
    const box = await next.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  }

  // The detail is one tap away, not in your face.
  await expect(page.getByText("What changed in your plan")).toBeVisible();
  await expect(page.getByLabel("What changed in your plan", { exact: true })).toBeHidden();
  await page.getByText("What changed in your plan").click();
  await expect(page.getByLabel("What changed in your plan", { exact: true })).toContainText(/Comes back/);
});
