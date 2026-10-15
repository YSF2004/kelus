import assert from "node:assert/strict";
import test from "node:test";
import { describeRouteChoice, describeRoutePayoff } from "../lib/today-reason.ts";

test("a first attempt is described as missing evidence, not low ability", () => {
  const explanation = describeRouteChoice(
    { reasons: ["LOW_CONFIDENCE_ESTIMATE", "HIGH_EXAM_VALUE"] },
    { retrievalAttempts: 0 },
  );
  assert.deepEqual(explanation, [
    "For new topics, your plan follows your notes. You haven’t tried this one yet.",
  ]);
});

test("earlier weak answers and prerequisite value explain the choice", () => {
  const explanation = describeRouteChoice(
    { reasons: ["LOW_MASTERY", "PREREQUISITE_GAP"] },
    { retrievalAttempts: 3 },
  );
  assert.deepEqual(explanation, [
    "Your last answers here were shaky.",
    "It helps with the topics that build on it.",
  ]);
});

test("mixed recall and untagged choices avoid invented precision", () => {
  assert.match(describeRouteChoice({ reasons: [] })[0], /mixed-recall/);
  assert.deepEqual(
    describeRouteChoice({ reasons: [] }, { retrievalAttempts: 2 }),
    ["Next in your plan."],
  );
});

test("route choice includes a useful student-facing payoff", () => {
  assert.match(
    describeRoutePayoff({ reasons: ["PREREQUISITE_GAP"] }, "Supply & Demand"),
    /make Supply & Demand easier/,
  );
  assert.match(
    describeRoutePayoff({ reasons: ["HIGH_EXAM_VALUE"] }),
    /better evidence/,
  );
});

test("the reason quotes your own last answer and when it was, not a generic label", async () => {
  const now = "2026-10-13T10:00:00.000Z";
  const concept = { id: "c1", retrievalAttempts: 2 };
  const events = [
    { conceptId: "c1", kind: "retrieval", outcome: "success", createdAt: "2026-10-08T10:00:00.000Z" },
    { conceptId: "c1", kind: "retrieval", outcome: "partial", createdAt: "2026-10-10T10:00:00.000Z" },
    { conceptId: "other", kind: "retrieval", outcome: "failure", createdAt: "2026-10-12T10:00:00.000Z" },
  ];
  assert.deepEqual(
    describeRouteChoice({ reasons: ["LOW_MASTERY", "PREREQUISITE_GAP"] }, concept, { events, nowIso: now, dependents: ["Market equilibrium"] }),
    ["Last time, 3 days ago, it came out partly right (1 of 2 tries went well).", "Market equilibrium builds on it."],
  );
  const known = describeRouteChoice({ reasons: ["REVIEW_DUE"] }, { id: "c1", retrievalAttempts: 1 }, { events: [events[0]], nowIso: now });
  assert.deepEqual(known, ["Last time, 5 days ago, you knew it, so this checks it stays."]);
});

test("many dependents are counted, and no evidence falls back to the plain reason", () => {
  assert.equal(describeRouteChoice({ reasons: ["PREREQUISITE_GAP"] }, { id: "c", retrievalAttempts: 0 }, { dependents: ["A", "B", "C"] })[1], "A and 2 more topics build on it.");
  assert.equal(describeRouteChoice({ reasons: ["PREREQUISITE_GAP"] }, { id: "c", retrievalAttempts: 0 }, { dependents: ["A", "B"] })[1], "A and B build on it.");
  assert.equal(describeRouteChoice({ reasons: ["LOW_MASTERY"] }, { id: "c", retrievalAttempts: 3 }, { events: [], nowIso: "2026-10-13T10:00:00.000Z" })[0], "Your last answers here were shaky.");
});

test("after a topic, the plan line names the topic your answer moved", async () => {
  const { planLine } = await import("../lib/verdict.ts");
  assert.equal(planLine({ next: "Elasticity", movedUp: "Elasticity", orderChanged: true }), "Your answer moved Elasticity up, so it is next.");
  assert.equal(planLine({ next: "Elasticity", movedUp: "Tax incidence", orderChanged: true }), "Your answer moved Tax incidence up in your plan. Next: Elasticity.");
  assert.equal(planLine({ next: "Elasticity", orderChanged: false }), "Next: Elasticity.");
  assert.equal(planLine({ orderChanged: false }), "That was the last topic for now.");
});
