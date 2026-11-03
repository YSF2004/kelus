import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// "Take photos of your notes": a photo of a printed page becomes a one-page PDF, read on this device by OCR, and its
// real topics come out of it, like any scanned PDF.
test("a photo of a printed page is read on the device and its topics are found", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/today/");
  // The start screen keeps one file input (the PDF one); the photo picker is made when the button is tapped.
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Take photos of your notes" }).click();
  await (await chooser).setFiles({ name: "IMG_2041.jpg", mimeType: "image/jpeg", buffer: readFileSync("tests/fixtures/photos/cell-transport-page.jpg") });
  await expect(page.getByText(/1 page/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add another page" })).toBeVisible();
  await page.getByRole("button", { name: "Read this page" }).click();

  // The same next step as a PDF: the topics Kelus found, or straight to the ready card.
  const review = page.getByRole("heading", { name: "Check the topics in your notes." });
  const ready = page.locator("#built-title");
  await review.or(ready).first().waitFor({ timeout: 150_000 });
  // The same three topics the original PDF gives, and not its title or a sentence tail.
  const found = await page.locator("body").innerText();
  for (const topic of ["Diffusion", "Osmosis", "Active transport"]) expect(found).toContain(topic);
  if (await review.count()) await expect(page.getByText("Substances cross the membrane")).toHaveCount(0);
});
