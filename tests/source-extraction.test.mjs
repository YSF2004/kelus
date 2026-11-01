import assert from "node:assert/strict";
import test from "node:test";
import { extractSourcePages } from "../lib/source-extraction.ts";

test("uploaded plain text is normalized into source sections without heading syntax", async () => {
  const file = new File([
    "Osmosis\nWater moves across a membrane toward more solute.\n\nActive transport\nUses ATP to move substances against a gradient.",
  ], "biology.txt", { type: "text/plain" });
  const extraction = await extractSourcePages(file);
  assert.equal(extraction.isNotes, true);
  assert.deepEqual(extraction.pages.map((page) => page.text.split("\n")[0]), ["Osmosis", "Active Transport"]);
});
