import { expect, test } from "@playwright/test";

test("the first visit and a client-side route change each send one page view after GA config", async ({ page }) => {
  // Exercise the real bootstrap and routing without contacting Google's production endpoint.
  await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
  await page.goto("/?pilot=study-group&via=invite");

  const commands = () => page.evaluate(() => (window.dataLayer ?? []).map((item) => Array.from(item as IArguments)));
  await expect.poll(async () => (await commands()).filter((item) => item[0] === "event" && item[1] === "page_view").length).toBe(1);
  const first = await commands();
  expect(first.findIndex((item) => item[0] === "config")).toBeLessThan(first.findIndex((item) => item[1] === "page_view"));
  expect(first.filter((item) => item[1] === "invite_opened")).toHaveLength(1);

  await page.locator('a[href="/route/"]').first().click();
  await expect(page).toHaveURL(/\/route\/?$/);
  await expect.poll(async () => (await commands()).filter((item) => item[0] === "event" && item[1] === "page_view").length).toBe(2);
  const views = (await commands()).filter((item) => item[1] === "page_view");
  expect(views[0]?.[2]).toMatchObject({ page_path: "/?pilot=study-group&via=invite" });
  expect(views[1]?.[2]).toMatchObject({ page_path: "/route/" });
});
