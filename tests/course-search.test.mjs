import assert from "node:assert/strict";
import test from "node:test";
import { searchCourse, searchCoursePages, searchCoursePagesIndexed } from "../lib/course-search.ts";

const concepts = [
  { id: "osmosis", name: "Osmosis" },
  { id: "mitosis", name: "Mitosis" },
];

const activities = [
  {
    conceptId: "osmosis",
    learn: { explanation: "Water crosses a membrane.", keyPoints: ["Water moves toward the more concentrated solution."] },
    teach: { facts: ["Water moves across a selectively permeable membrane toward the side with more dissolved solute."], pageText: "Osmosis is the movement of water across a selectively permeable membrane." },
    retrieve: { prompt: "Which way does water move in osmosis?", modelAnswer: "Toward the side with more dissolved solute.", hint: "Read page 3." },
    apply: { prompt: "Apply osmosis.", modelAnswer: "Use concentration." },
    sourceReferences: [{ materialId: "notes", label: "Cell biology", locator: "Page 3" }],
  },
  {
    conceptId: "mitosis",
    learn: { explanation: "Cells divide.", keyPoints: ["Mitosis makes two daughter cells."] },
    retrieve: { prompt: "What does mitosis make?", modelAnswer: "Two daughter cells.", hint: "Read page 6." },
    apply: { prompt: "Apply mitosis.", modelAnswer: "Cell division." },
    sourceReferences: [{ materialId: "notes", label: "Cell biology", locator: "Page 6" }],
  },
];

test("course search answers only from a matching confirmed course passage", () => {
  const results = searchCourse("Which way does water move in osmosis?", concepts, activities);
  assert.equal(results[0].conceptId, "osmosis");
  assert.match(results[0].answer, /Water moves across a selectively permeable membrane/i);
  assert.deepEqual(results[0].source, { materialId: "notes", label: "Cell biology", locator: "Page 3" });
});

test("course search does not invent a result for an unsupported question", () => {
  assert.deepEqual(searchCourse("What causes a volcanic eruption?", concepts, activities), []);
});

test("page search returns the original sentence and a precise source location", () => {
  const results = searchCoursePages("why water moves in osmosis", [{
    materialId: "cell-notes",
    label: "Cell Biology lecture",
    locatorLabel: "Page",
    pages: [{ pageNumber: 4, text: "Osmosis moves water across a selectively permeable membrane toward a higher solute concentration. Cells use this movement to maintain balance." }],
  }]);

  assert.equal(results.length, 1);
  assert.equal(results[0].answer, "Osmosis moves water across a selectively permeable membrane toward a higher solute concentration.");
  assert.deepEqual(results[0].source, { materialId: "cell-notes", label: "Cell Biology lecture", locator: "Page 4" });
});

test("indexed page search tolerates a small typo without leaving the course material", async () => {
  const results = await searchCoursePagesIndexed("osmosiss membrane", [{
    materialId: "cell-notes",
    label: "Cell Biology lecture",
    locatorLabel: "Page",
    pages: [{ pageNumber: 4, text: "Osmosis moves water across a selectively permeable membrane toward a higher solute concentration." }],
  }]);

  assert.equal(results.length, 1);
  assert.equal(results[0].quote, "Osmosis moves water across a selectively permeable membrane toward a higher solute concentration.");
  assert.deepEqual(results[0].source, { materialId: "cell-notes", label: "Cell Biology lecture", locator: "Page 4" });
});
