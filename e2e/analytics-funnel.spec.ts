import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { playQuickRun, startFromFile } from "./helpers";

test("a real notes journey emits real-course milestones without note content", async ({ page }) => {
  await page.addInitScript(() => {
    const observed = window as typeof window & { kelusEvents: Array<{ name: string; parameters: Record<string, unknown> }> };
    observed.kelusEvents = [];
    window.gtag = (command, name, parameters) => {
      if (command === "event" && parameters) observed.kelusEvents.push({ name: String(name), parameters });
    };
  });
  await startFromFile(page, {
    name: "biology-notes.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(readFileSync("tests/fixtures/notion-export.md", "utf8")),
  });
  await playQuickRun(page, "A membrane controls which materials can move in and out of a cell.", "Partly");
  const events = await page.evaluate(() => (window as typeof window & { kelusEvents: Array<{ name: string; parameters: Record<string, unknown> }> }).kelusEvents);
  for (const name of ["material_upload_completed", "material_processing_completed", "first_route_ready", "session_started", "study_response_recorded"]) {
    const event = events.find((item) => item.name === name);
    expect(event, `${name} was emitted`).toBeTruthy();
    expect(event?.parameters.course_type).toBe("real");
  }
  expect(events.find((item) => item.name === "material_processing_completed")?.parameters).toMatchObject({ source_type: "notes", used_ocr: false });
  expect(JSON.stringify(events)).not.toContain("A membrane controls");
});
