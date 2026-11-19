import assert from "node:assert/strict";
import test from "node:test";
import { extractPastPaperQuestions, mapPastPaperQuestions, summarizePastPaperCoverage } from "../domain/past-paper.ts";

const concepts = [
  { id: "osmosis", name: "Osmosis", mastery: 0.35 },
  { id: "cell-membrane", name: "Cell membrane", mastery: 0.8 },
];

const activities = [
  {
    conceptId: "osmosis",
    learn: { title: "Osmosis", explanation: "Water moves across a selectively permeable membrane.", keyPoints: ["Water moves toward higher solute concentration."] },
    teach: { pageText: "Osmosis is the movement of water across a selectively permeable membrane toward higher solute concentration.", facts: [] },
    sourceReferences: [{ materialId: "lecture-1", label: "Cell transport", locator: "Page 4" }],
  },
  {
    conceptId: "cell-membrane",
    learn: { title: "Cell membrane", explanation: "The membrane controls exchange.", keyPoints: [] },
    sourceReferences: [{ materialId: "lecture-1", label: "Cell transport", locator: "Page 2" }],
  },
];

test("past-paper mode extracts question-shaped prompts but leaves answer-only text alone", () => {
  const questions = extractPastPaperQuestions([{ pageNumber: 2, text: "Question 1. Explain why water moves by osmosis across a selectively permeable membrane.\n\nAnswer all questions in blue ink.\n\n2. Define the cell membrane." }]);
  assert.deepEqual(questions.map((item) => item.text), ["Explain why water moves by osmosis across a selectively permeable membrane.", "Define the cell membrane."]);
  assert.deepEqual(questions.map((item) => item.pageNumber), [2, 2]);
});

test("past-paper mode maps prompts to confirmed concepts and keeps their actual source reference", () => {
  const questions = extractPastPaperQuestions([{ pageNumber: 2, text: "Question 1. Explain why water moves by osmosis across a selectively permeable membrane." }]);
  const mapped = mapPastPaperQuestions({ questions, concepts, activities });
  assert.equal(mapped[0].matches[0].conceptName, "Osmosis");
  assert.deepEqual(mapped[0].matches[0].sources, [{ materialId: "lecture-1", label: "Cell transport", locator: "Page 4" }]);
  assert.equal(mapped[0].matches[0].mastery, 0.35);
});

test("past-paper mode does not invent a match when no confirmed course topic supports the prompt", () => {
  const questions = extractPastPaperQuestions([{ pageNumber: 3, text: "Question 4. Calculate the annual interest rate for the loan." }]);
  assert.deepEqual(mapPastPaperQuestions({ questions, concepts, activities })[0].matches, []);
});

test("exam brief prioritizes weak, directly linked coverage and labels the rest as unlinked rather than safe", () => {
  const questionMaps = mapPastPaperQuestions({
    questions: extractPastPaperQuestions([{ pageNumber: 2, text: "Question 1. Explain osmosis across a selectively permeable membrane.\n\nQuestion 2. Define the cell membrane." }]),
    concepts: [...concepts, { id: "enzymes", name: "Enzymes", mastery: 0.2, retrievalAttempts: 0 }],
    activities,
  });
  const brief = summarizePastPaperCoverage({
    questionMaps,
    concepts: concepts.map((concept, index) => ({ ...concept, retrievalAttempts: index ? 2 : 0 })).concat([{ id: "enzymes", name: "Enzymes", mastery: 0.2, retrievalAttempts: 0 }]),
  });
  assert.equal(brief.priority.conceptId, "osmosis");
  assert.equal(brief.linkedTopicCount, 2);
  assert.equal(brief.unlinkedTopicCount, 1);
  assert.equal(brief.topics.find((topic) => topic.conceptId === "osmosis").promptCount, 2);
});
