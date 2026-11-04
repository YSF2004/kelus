import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// "Share to Kelus" from another Android app: the system posts the file to the manifest's share_target, the service
// worker keeps it on the device and opens Today, and Today imports it exactly like a file dropped on the start screen.
test("a PDF shared from another app is read like a dropped one, once", async ({ page }) => {
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
  expect(manifest.share_target).toMatchObject({ action: "/share-target/", method: "POST", enctype: "multipart/form-data" });

  await page.goto("/today/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  // Model Android's top-level multipart form submission, rather than a fetch that can hide a bad redirect.
  await page.evaluate(() => {
    const form = document.createElement("form");
    form.id = "share-target-test-form";
    form.method = "POST";
    form.enctype = "multipart/form-data";
    form.action = "/share-target/";
    const input = document.createElement("input");
    input.type = "file";
    input.name = "file";
    form.append(input);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Share file to Kelus";
    form.append(submit);
    document.body.append(form);
  });
  await page.locator("#share-target-test-form input[type=file]").setInputFiles({
    name: "biology-ch7-cell-transport.pdf",
    mimeType: "application/pdf",
    buffer: readFileSync("tests/fixtures/course-pdfs/biology-ch7-cell-transport.pdf"),
  });
  await Promise.all([
    page.waitForURL(/\/today\/\?shared=1$/),
    page.getByRole("button", { name: "Share file to Kelus" }).click(),
  ]);

  // The same course a dropped PDF makes: named from the chapter, with its topics, and the file listed once.
  const review = page.getByRole("heading", { name: "Check the topics in your notes." });
  const course = page.getByRole("heading", { name: /Cell Transport/, level: 1 });
  await review.or(course).first().waitFor({ timeout: 45_000 });
  if (await review.count()) await page.getByRole("button", { name: /^(?:Use|Start with) \d+ topics?$/ }).click();
  await expect(course).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "Diffusion", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/today\/?$/);
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(1);

  // Read once: opening the same link again imports nothing more.
  await page.goto("/today/?shared=1");
  await expect(page.getByRole("heading", { name: /Cell Transport/, level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(1);
});
