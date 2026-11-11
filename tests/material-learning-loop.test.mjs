import assert from "node:assert/strict";
import test from "node:test";
import { proposeConceptsFromPages } from "../domain/material-intelligence.ts";
import { evaluateAnswer } from "../domain/answer-evaluation.ts";
import {
  completeDiagnosis,
  completeOnboarding,
  confirmMaterialConcepts,
  finishSession,
  recordRetrieval,
  removeMaterialLearning,
  startSession,
} from "../lib/demo-store.ts";
import { MATERIAL_PAGE_FIXTURES } from "./fixtures/material-pages.ts";

const NOW = Date.parse("2026-09-06T12:00:00.000Z");

function setupState() {
  return completeOnboarding({
    courseName: "Foundations",
    examName: "Final exam",
    examDate: "2026-10-06",
    targetPercent: 85,
    availableMinutes: 30,
  }, NOW);
}

function proposals(subject, materialId) {
  return proposeConceptsFromPages({ materialId, sourceLabel: `${subject} source`, pages: MATERIAL_PAGE_FIXTURES[subject] });
}

test("student journey runs from confirmed material to a cited adaptive session", () => {
  let state = confirmMaterialConcepts(setupState(), proposals("biology", "material-biology"));
  assert.equal(state.snapshot.concepts.length, 2);
  assert.equal(state.snapshot.learningActivities[0].sourceReferences[0].locator, "Page 3");

  const ratings = Object.fromEntries(state.snapshot.concepts.map((concept) => [concept.id, "weak"]));
  state = completeDiagnosis(state, { ratings, retrievals: [] });
  const course = state.snapshot.courses[0];
  const exam = state.snapshot.exams[0];
  const started = startSession(state, course.id, exam.id);
  state = started.state;
  const conceptId = started.session.plannedConceptIds[0];
  const conceptBefore = state.snapshot.concepts.find((concept) => concept.id === conceptId);
  const prompt = state.snapshot.prompts.find((item) => item.conceptId === conceptId);
  assert.ok(conceptBefore && prompt);

  const evaluation = evaluateAnswer({ response: "Cells transfer energy from glucose into ATP through respiration.", expected: prompt.modelAnswer });
  state = recordRetrieval(state, {
    conceptId,
    sessionId: started.session.id,
    promptId: prompt.id,
    responseText: "Cells transfer energy from glucose into ATP through respiration.",
    outcome: evaluation.outcome,
    evaluation,
    responseTimeMs: 18_000,
  });
  const conceptAfter = state.snapshot.concepts.find((concept) => concept.id === conceptId);
  assert.ok(conceptAfter.mastery > conceptBefore.mastery);
  assert.equal(state.snapshot.events.at(-1).evaluation.method, "source_rubric");
  state = finishSession(state, started.session.id, [conceptBefore]);
  assert.equal(state.snapshot.sessions.find((session) => session.id === started.session.id).status, "complete");
});

test("confirming another material keeps earlier sources and removal cleans dependent learning state", () => {
  let state = confirmMaterialConcepts(setupState(), proposals("biology", "material-biology"));
  state = confirmMaterialConcepts(state, proposals("history", "material-history"));
  assert.ok(state.snapshot.learningActivities.some((activity) => activity.sourceReferences.some((reference) => reference.materialId === "material-biology")));
  assert.ok(state.snapshot.learningActivities.some((activity) => activity.sourceReferences.some((reference) => reference.materialId === "material-history")));

  state = removeMaterialLearning(state, "material-biology");
  assert.equal(state.snapshot.learningActivities.some((activity) => activity.sourceReferences.some((reference) => reference.materialId === "material-biology")), false);
  assert.equal(state.snapshot.concepts.some((concept) => concept.name === "CELLULAR RESPIRATION"), false);
  assert.equal(state.snapshot.concepts.some((concept) => concept.name === "Labor Movements"), true);
  assert.ok(state.snapshot.prompts.every((prompt) => state.snapshot.concepts.some((concept) => concept.id === prompt.conceptId)));
});
