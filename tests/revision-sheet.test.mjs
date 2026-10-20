import assert from "node:assert/strict";
import test from "node:test";
import { ownWords, revisionSheet } from "../domain/revision-sheet.ts";

test("the sheet keeps the student's own latest explanation per topic, beside their notes, with what it left out", () => {
  const concepts = [{ id: "a", name: "Osmosis" }, { id: "b", name: "Enzymes" }];
  const activities = [
    { conceptId: "a", retrieve: { modelAnswer: "Osmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution." } },
    { conceptId: "b", retrieve: { modelAnswer: "Enzymes are biological catalysts that speed up reactions without being used up." } },
  ];
  const events = [
    { conceptId: "a", kind: "retrieval", promptId: "p1", createdAt: "2026-10-18T10:00:00Z", responseText: "Water moves somewhere.\n\nApplication: 1 of 2" },
    { conceptId: "a", kind: "retrieval", promptId: "p2", createdAt: "2026-10-20T10:00:00Z", responseText: "Water moves across the membrane to the more concentrated side.\n\nApplication: 2 of 2" },
    { conceptId: "a", kind: "retrieval", promptId: "checkpoint-a", createdAt: "2026-10-21T10:00:00Z", responseText: "Checkpoint: 2 of 2 lines from memory." },
    { conceptId: "b", kind: "retrieval", promptId: "p3", createdAt: "2026-10-20T10:00:00Z", responseText: "I don't remember\n\nApplication: 0 of 2" },
  ];
  const missed = [{ conceptId: "a", name: "Osmosis", quote: "In a hypertonic solution the cell loses water.", at: "2026-10-20T10:00:00Z" }];
  const sheet = revisionSheet({ concepts, activities, events, missed });
  assert.equal(sheet.total, 2);
  assert.equal(sheet.written, 1, "a shrug is not an explanation");
  const [osmosis, enzymes] = sheet.entries;
  assert.equal(osmosis.words, "Water moves across the membrane to the more concentrated side.", "the latest, never a checkpoint's line");
  assert.ok(osmosis.leftOut.length > 0 && osmosis.leftOut.length <= 3);
  assert.deepEqual(osmosis.comingBack, ["In a hypertonic solution the cell loses water."]);
  assert.equal(enzymes.words, null);
  assert.equal(sheet.comingBack, 1);
  assert.equal(ownWords("Too short"), null);
});
