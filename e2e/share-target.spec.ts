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

  // What Android sends: a multipart POST with the file. The worker answers with a redirect to Today.
  const pdf = [...readFileSync("tests/fixtures/course-pdfs/biology-ch7-cell-transport.pdf")];
  const status = await page.evaluate(async (bytes) => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(bytes)], "biology-ch7-cell-transport.pdf", { type: "application/pdf" }));
    const response = await fetch("/share-target/", { method: "POST", body: form, redirect: "manual" });
    return response.type === "opaqueredirect" ? "redirect" : String(response.status);
  }, pdf);
  expect(status).toBe("redirect");

  // The same course a dropped PDF makes: named from the chapter, with its topics, and the file listed once.
  await page.goto("/today/?shared=1");
  const review = page.getByRole("heading", { name: "Check the topics Kelus found." });
  const course = page.getByRole("heading", { name: /Cell Transport/, level: 1 });
  await review.or(course).first().waitFor({ timeout: 45_000 });
  if (await review.count()) await page.getByRole("button", { name: /^Use \d+ topics?$/ }).click();
  await expect(course).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "Diffusion", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/today\/?$/);
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(1);

  // Read once: opening the same link again imports nothing more.
  await page.goto("/today/?shared=1");
  await expect(page.getByRole("heading", { name: /Cell Transport/, level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(1);
});
