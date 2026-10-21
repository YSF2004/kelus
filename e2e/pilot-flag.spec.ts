import { expect, test } from "@playwright/test";
import { startFromPaste } from "./helpers";

const notes = "Cell biology\n\nOsmosis\nOsmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. In a hypotonic solution a plant cell gains water and becomes turgid because the cell wall pushes back. In a hypertonic solution the cell loses water and becomes plasmolysed.\n\nDiffusion\nDiffusion is the net movement of particles from an area of higher concentration to an area of lower concentration. It is a passive process, so it needs no energy from the cell.";

test("a question can be flagged in one tap, is remembered, and its words go to Kelus only on a second tap", async ({ page }) => {
  // No real email in tests: the inbox request is caught and inspected.
  let sent: Record<string, string> | null = null;
  await page.route(/formsubmit\.co/, async (route) => { sent = route.request().postDataJSON(); await route.fulfill({ status: 200, contentType: "application/json", body: '{"success":"true"}' }); });
  await startFromPaste(page, notes);
  const check = page.getByLabel(/^Check 1 of \d$/);
  // The ask and the quoted line sit on two lines of the heading; the question sent is the one line.
  const prompt = (await check.locator("h1").textContent() ?? "").replace(/\s+/g, " ").trim();
  await page.getByRole("button", { name: "I’m not sure" }).click();
  await page.getByRole("button", { name: "Flag this question" }).click();
  await page.getByRole("group", { name: "What is wrong with this question?" }).getByRole("button", { name: "Doesn’t make sense" }).click();
  await expect(page.getByText("Flagged. Kelus won’t ask it again.")).toBeVisible();
  expect(sent).toBeNull();
  // Remembered on this device, so later runs leave it out.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kelus:flagged-questions:v1") ?? "[]").length)).toBe(1);
  await page.getByRole("button", { name: "Send it to the Kelus team" }).click();
  await expect(page.getByText("Sent to the Kelus team, thank you.")).toBeVisible();
  expect(sent).not.toBeNull();
  expect(sent!.message).toContain("Reason: Doesn’t make sense");
  // textContent joins the ask and the quote with no space; compare without spaces before the quote.
  const flat = (text: string) => text.replace(/\s+/g, " ").replace(/\s*“/g, "“");
  expect(flat(sent!.message)).toContain(flat(`Question: ${prompt}`));
  // Next still works, and Enter still goes to it.
  await expect(page.getByRole("button", { name: /^(Next|Now say it yourself)/ })).toBeVisible();
});
