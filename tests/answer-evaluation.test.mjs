import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAnswer, evaluateSessionAnswers } from "../domain/answer-evaluation.ts";

const EXPECTED = "Electrons move through membrane proteins and create the proton gradient used by ATP synthase.";

test("source-grounded evaluation rejects an unrelated confident answer", () => {
  const result = evaluateAnswer({ response: "I understand this perfectly and can use it.", expected: EXPECTED });
  assert.equal(result.outcome, "failure");
  assert.equal(result.method, "source_rubric");
});

test("source-grounded evaluation recognizes central evidence", () => {
  const result = evaluateAnswer({ response: "Electrons move through membrane proteins, creating a proton gradient that ATP synthase uses.", expected: EXPECTED });
  assert.equal(result.outcome, "success");
  assert.ok(result.matchedTerms.includes("electron"));
});

test("transparent equivalence groups accept a faithful paraphrase", () => {
  const result = evaluateAnswer({
    response: "Membrane proteins transport electrons. That produces a proton gradient, which ATP synthase uses to make ATP.",
    expected: EXPECTED,
  });
  assert.notEqual(result.outcome, "failure");
  assert.equal(result.missingTerms.length, 0);
});

test("matching vocabulary cannot hide a reversed source claim", () => {
  const result = evaluateAnswer({
    response: "Electrons move through membrane proteins, but this does not create a proton gradient and ATP synthase cannot use it.",
    expected: EXPECTED,
  });
  assert.equal(result.outcome, "failure");
  assert.match(result.explanation, /reverses|negates/);
});

test("session evaluation combines retrieval and application evidence conservatively", () => {
  const result = evaluateSessionAnswers({
    retrievalResponse: "Electrons move through membrane proteins to create a proton gradient.",
    retrievalExpected: EXPECTED,
    applicationResponse: "If the membrane proteins are blocked, the proton gradient and ATP production fall.",
    applicationExpected: `A sound application should preserve the source's central claim: ${EXPECTED}`,
  });
  assert.notEqual(result.outcome, "failure");
  assert.ok(result.score > 0.24);
});
