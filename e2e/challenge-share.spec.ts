import { expect, test } from "@playwright/test";

const storageUrl = "https://challenge-test.supabase.co/storage/v1/object/sign/kelus-course-materials/demo/challenges/set.txt?token=mock";
const payload = {
  version: 1,
  cards: [
    { question: "What is active recall?", answer: "Retrieving an idea from memory rather than rereading it.", explanation: "It makes gaps visible." },
    { question: "When does spaced repetition bring an idea back?", answer: "When review is useful for retaining it." },
  ],
};

test("a recipient can reveal and reflect without sending the signed token to analytics or referrers", async ({ page }) => {
  let requestReferer = "";
  await page.route("**/storage/v1/object/sign/kelus-course-materials/**", async (route) => {
    requestReferer = route.request().headers().referer ?? "";
    await route.fulfill({ status: 200, contentType: "text/plain", body: JSON.stringify(payload) });
  });
  await page.route("https://www.googletagmanager.com/**", (route) => route.abort());

  await page.goto(`/challenge/#${new URLSearchParams({ source: storageUrl })}`);
  await expect(page.getByRole("heading", { name: "Try these questions in your own words." })).toBeVisible();
  await expect(page).toHaveURL(/\/challenge\/?#source=/);
  await expect(page.getByText("What is active recall?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show the answer" })).toBeVisible();
  expect(requestReferer).toBe("");

  await page.getByRole("button", { name: "Show the answer" }).click();
  await expect(page.getByText("Retrieving an idea from memory rather than rereading it.")).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.getByRole("button", { name: "Show the answer" }).click();
  await page.getByRole("button", { name: "Partly there" }).click();
  await expect(page.getByRole("heading", { name: "You made it through 2 cards." })).toBeVisible();
  await expect(page.getByText(/1 felt clear · 1 partly there/)).toBeVisible();

  const pageViews = await page.evaluate(() => ((window.dataLayer ?? []) as unknown[][])
    .filter((item) => item[0] === "event" && item[1] === "page_view")
    .map((item) => (item[2] as { page_location?: string }).page_location ?? ""));
  expect(pageViews.every((location) => !location.includes("token=mock"))).toBe(true);
});

test("an external source URL is rejected before any fetch", async ({ page }) => {
  let requested = false;
  await page.route("**/*", async (route) => {
    if (route.request().url().includes("attacker.example")) requested = true;
    await route.continue();
  });
  const evil = "https://attacker.example/storage/v1/object/sign/kelus-course-materials/path.txt?token=mock";
  await page.goto(`/challenge/#${new URLSearchParams({ source: evil })}`);
  await expect(page.getByRole("heading", { name: "This challenge isn’t available." })).toBeVisible();
  await expect(page.getByText(/missing or invalid/)).toBeVisible();
  expect(requested).toBe(false);
});
