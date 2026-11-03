import { expect, test } from "@playwright/test";
import { playQuickRun, startFromPaste } from "./helpers";

const notes = "Cell Biology\n\nOsmosis\nOsmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. In a hypotonic solution a plant cell gains water and becomes turgid because the cell wall pushes back.";

test("the exam date reads back in words with the days left, and goes into the student's own calendar", async ({ page }) => {
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
  const file = ask.getByRole("link", { name: "Apple or Outlook" });
  await expect(file).toHaveAttribute("download", "kelus-exam.ics");
  const ics = decodeURIComponent((await file.getAttribute("href"))!.replace(/^data:text\/calendar;charset=utf-8,/, ""));
  expect(ics).toContain(`DTSTART;VALUE=DATE:${iso.replace(/-/g, "")}`);
  expect(ics).toContain("SUMMARY:Exam: Cell Biology");
  const google = ask.getByRole("link", { name: "Google Calendar" });
  await expect(google).toHaveAttribute("href", new RegExp(`^https://calendar\\.google\\.com/calendar/render\\?action=TEMPLATE.*dates=${iso.replace(/-/g, "")}`));
  // Choosing a calendar also saves the date in Kelus: the question is answered.
  await page.context().route("https://calendar.google.com/**", (route) => route.fulfill({ status: 204, body: "" }));
  await google.click();
  await expect(ask).toHaveCount(0);
  await expect(page.locator("main")).toContainText(/20 days to exam/);
});
