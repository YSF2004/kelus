import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { gotoStart } from "./helpers";

for (const width of [390, 1280]) {
  test(`an import error preserves pasted notes and allows another source at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await gotoStart(page);
    await page.getByText("Or paste your notes", { exact: true }).click();
    const draft = "My draft notes should stay here while I choose another file.";
    await page.locator("textarea").fill(draft);
    const input = page.getByLabel("Choose a PDF or notes", { exact: true });
    await input.setInputFiles({
      name: "unsupported.docx",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not a supported source"),
    });
    await expect(page.getByRole("alert")).toContainText("Couldn’t use unsupported.docx.");
    await expect(page.locator("textarea")).toHaveValue(draft);
    const chooserEvent = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Choose another file" }).click();
    const chooser = await chooserEvent;
    await chooser.setFiles({
      name: "cell-biology.md",
      mimeType: "text/markdown",
      buffer: readFileSync("tests/fixtures/notion-export.md"),
    });
    await expect(page.getByRole("heading", { name: "Check the topics Kelus found." })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}
