import { expect, test } from "@playwright/test";
import { playQuickRun, startFromPaste } from "./helpers";

const notes = "Cell Biology\n\nOsmosis\nOsmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. In a hypotonic solution a plant cell gains water and becomes turgid because the cell wall pushes back.";

test("the exam date reads back in words with the days left, and goes into the device's own calendar", async ({ page }) => {
  await startFromPaste(page, notes);
  await playQuickRun(page, "Water moves across a membrane.", "Partly");
  await page.goto("/today");
  const ask = page.getByRole("region", { name: "When is your exam?" });
  await expect(ask).toContainText("Choose the day");
  const day = new Date(Date.now() + 20 * 86_400_000);
  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  await ask.getByLabel("Exam date").fill(iso);
  await expect(ask).toContainText("in 20 days");
  await expect(ask).toContainText(day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
  // The test browser is not an Apple device, so the one calendar link is Google's add-event page for that day.
  const google = ask.getByRole("link", { name: /Also add to my calendar/ });
  await expect(google).toHaveAttribute("href", new RegExp(`^https://calendar\\.google\\.com/calendar/render\\?action=TEMPLATE.*dates=${iso.replace(/-/g, "")}`));
  // Choosing a calendar also saves the date in Kelus: the question is answered.
  await page.context().route("https://calendar.google.com/**", (route) => route.fulfill({ status: 204, body: "" }));
  await google.click();
  await expect(ask).toHaveCount(0);
  await expect(page.locator("main")).toContainText(/20 days to exam/);
});

test.describe("on an iPhone", () => {
  test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
  test("the same link is the calendar file Apple Calendar adds", async ({ page }) => {
    await startFromPaste(page, notes);
    await playQuickRun(page, "Water moves across a membrane.", "Partly");
    await page.goto("/today");
    const ask = page.getByRole("region", { name: "When is your exam?" });
    const day = new Date(Date.now() + 20 * 86_400_000);
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    await ask.getByLabel("Exam date").fill(iso);
    const link = ask.getByRole("link", { name: /Also add to my calendar/ });
    await expect(link).toHaveAttribute("download", "kelus-exam.ics");
    const ics = decodeURIComponent((await link.getAttribute("href"))!.replace(/^data:text\/calendar;charset=utf-8,/, ""));
    expect(ics).toContain(`DTSTART;VALUE=DATE:${iso.replace(/-/g, "")}`);
    expect(ics).toContain("SUMMARY:Exam: Cell Biology");
  });
});
