import assert from "node:assert/strict";
import test from "node:test";
import { evaluateBenchmark, renderBenchmark } from "../scripts/product-benchmark.mjs";

function fixture() {
  return {
    version: 1, maxEvidenceAgeDays: 30,
    criteria: [{ id: "trust", label: "Trust", weight: 100, critical: true }],
    evidence: [{ id: "test", kind: "browser", reviewedAt: "2026-11-01", location: "Internal sanitized report" }],
    products: [
      { name: "Kelus", assessments: [{ criterion: "trust", status: "observed", scope: "standard", rating: 3, evidence: ["test"], note: "Observed" }] },
      { name: "Other", assessments: [] },
    ],
  };
}
const assess = (data) => data.products[0].assessments[0];
test("missing competitor evidence stays unknown rather than zero", () => {
  const result = evaluateBenchmark(fixture(), "2026-11-01");
  assert.equal(result.products[0].score, 7.5);
  assert.equal(result.products[1].score, null);
  assert.match(renderBenchmark(result), /Not established/);
});
test("sample success cannot establish a full-product score", () => {
  const data = fixture(); assess(data).scope = "sample";
  assert.equal(evaluateBenchmark(data, "2026-11-01").products[0].score, null);
});
test("documentation cannot masquerade as hands-on evidence", () => {
  const data = fixture(); data.evidence[0].kind = "official-doc";
  assert.throws(() => evaluateBenchmark(data, "2026-11-01"), /Official claims/);
  assess(data).status = "documented";
  assert.throws(() => evaluateBenchmark(data, "2026-11-01"), /unobserved/);
});
test("stale evidence loses eligibility and future dates are rejected", () => {
  assert.equal(evaluateBenchmark(fixture(), "2026-12-02").products[0].coverage, 0);
  assert.throws(() => evaluateBenchmark(fixture(), "2026-10-31"), /Future evidence/);
});
test("exceptional ratings require student study evidence", () => {
  const data = fixture(); assess(data).rating = 4;
  assert.throws(() => evaluateBenchmark(data, "2026-11-01"), /student-study/);
  data.evidence[0].kind = "student-study";
  assert.equal(evaluateBenchmark(data, "2026-11-01").products[0].ready, true);
});
test("reject malformed weights, duplicates and unknown evidence", () => {
  const data = fixture(); data.criteria[0].weight = 90;
  assert.throws(() => evaluateBenchmark(data, "2026-11-01"), /total 100/);
  data.criteria[0].weight = 100; data.products[0].assessments.push({ ...assess(data) });
  assert.throws(() => evaluateBenchmark(data, "2026-11-01"), /duplicate assessment/);
  data.products[0].assessments.pop(); assess(data).evidence = ["absent"];
  assert.throws(() => evaluateBenchmark(data, "2026-11-01"), /Unknown evidence/);
});
test("incomplete evidence never renormalizes the overall score", () => {
  const data = fixture();
  data.criteria[0].weight = 25;
  data.criteria.push({ id: "flow", label: "Flow", weight: 75, critical: false });
  const product = evaluateBenchmark(data, "2026-11-01").products[0];
  assert.equal(product.coverage, 25);
  assert.equal(product.score, null);
  assert.equal(product.ready, false);
});
test("a high average cannot hide a failed critical dimension", () => {
  const data = fixture();
  data.criteria[0].weight = 20;
  assess(data).rating = 1;
  data.criteria.push({ id: "flow", label: "Flow", weight: 80, critical: false });
  data.evidence[0].kind = "student-study";
  data.products[0].assessments.push({ criterion: "flow", status: "observed", scope: "standard", rating: 4, evidence: ["test"], note: "Observed" });
  const product = evaluateBenchmark(data, "2026-11-01").products[0];
  assert.equal(product.score, 8.5);
  assert.equal(product.ready, false);
  assert.deepEqual(product.blockers, ["Trust"]);
});
