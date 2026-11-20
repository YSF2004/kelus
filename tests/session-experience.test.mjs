import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createDemoLearningActivities } from "../data/demo-learning-activities.ts";
import { createDemoSnapshot } from "../data/demo-seed.ts";
import { MATERIAL_ROLES, materialRoleLabel } from "../domain/materials.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("every demo concept has a deterministic learn, retrieve and apply activity", () => {
  const snapshot = createDemoSnapshot(Date.parse("2026-09-05T12:00:00.000Z"));
  const activities = createDemoLearningActivities();
  assert.equal(activities.length, snapshot.concepts.length);
  for (const concept of snapshot.concepts) {
    const activity = activities.find((item) => item.conceptId === concept.id);
    assert.ok(activity, `missing activity for ${concept.id}`);
    assert.ok(activity.learn.explanation.length > 40);
    assert.ok(activity.retrieve.prompt.length > 10);
    assert.ok(activity.retrieve.hint.length > 10);
    assert.ok(activity.apply.prompt.length > 10);
    assert.ok(activity.apply.modelAnswer.length > 10);
    assert.deepEqual(activity.sourceReferences, [
      {
        materialId: "material-demo-microeconomics",
        label: "Built-in example",
        locator: null,
      },
    ]);
  }
});

test("the session executes learn, retrieve, apply and evaluate before updating the route", async () => {
  const page = await source("app/session/page.tsx");
  const result = await source("components/QuickResult.tsx");
  const order = [
    'phase === "learn"',
    'phase === "retrieve"',
    'phase === "apply"',
    'phase === "evaluate"',
  ].map((marker) => page.lastIndexOf(marker));
  assert.ok(order.every((position) => position >= 0));
  assert.ok(order.every((position, index) => index === 0 || position > order[index - 1]));
  assert.match(page, /Hint/);
  assert.match(page, />Explain</);
  assert.doesNotMatch(page, />Example</);
  assert.match(page, /session-help-page/);
  assert.match(page, /submit\(\{/);
  assert.match(page, /evaluateLearningResponse/);
  assert.doesNotMatch(page, />I can use it</);
  assert.match(page, /setPhase\("reroute"\)/);
  assert.match(page, /This check/);
  assert.match(page, /Try again/);
  assert.match(page, /Continue to \$\{nextConceptName\}/);
  assert.match(page, /rest of your plan is unchanged/);
  assert.match(page, /time plan changed/);
  assert.doesNotMatch(page, /Revisit \$\{concept\.name\} before moving on/);
  assert.doesNotMatch(page, /percent\(masteryBefore\)/);
  assert.match(result, /Show this exact line in your notes/);
  assert.match(result, /routeReason/);
  assert.match(result, /&& !routeReason/);
  assert.match(page, /Because this line from/);
  assert.doesNotMatch(page, /answer-comparison|reroute-lines|mastery-reward/);
});

test("materials support learning-purpose labels without claiming analysis", async () => {
  assert.deepEqual(MATERIAL_ROLES.map((item) => item.value), ["syllabus", "lecture_slides", "notes", "past_exam", "course_outline", "other"]);
  assert.equal(materialRoleLabel("past_exam"), "Past paper");
  const library = await source("components/MaterialLibrary.tsx");
  assert.match(library, /htmlFor="material-role">Type</);
  assert.match(library, /review every\s+suggested topic/);
  assert.match(library, /Confirm topics|Build my topic map|Build my Knowledge Map/);
  assert.match(library, /proposeConceptsFromPages/);
  assert.match(library, /PDFs with selectable text are read fastest/);
  assert.match(library, /topics and quoted lines you confirm/);
});

test("sessions expose a confirmed course source and its page", async () => {
  const page = await source("app/session/page.tsx");
  assert.match(page, /activity\.sourceReferences\.length/);
  assert.match(page, /Source/);
  assert.match(page, /openSource/);
  assert.match(page, /#page=/);
  assert.match(page, /session-source-panel/);
  assert.match(page, /<iframe/);
  assert.match(page, /Add the PDF again/);
  assert.doesNotMatch(page, /Sample course model/);
  assert.doesNotMatch(page, /window\.open\(`\$\{URL\.createObjectURL/);
});

test("a warm-up can reopen the exact local source line it asks about", async () => {
  const warmup = await source("app/session/warmup/page.tsx");
  assert.match(warmup, /primaryActivitySourceReference/);
  assert.match(warmup, /readableMaterials\.has\(reference\.materialId\)/);
  assert.match(warmup, /onShowLine=/);
  assert.match(warmup, /CourseSourceReader material=\{materialForSource\}/);
  assert.match(warmup, /Exact line from your notes/);
});

test("PDF sources are selectable documents, with the evidence mark layered above them", async () => {
  const reader = await source("components/CourseSourceReader.tsx");
  const styles = await source("app/core-workspace.css");
  assert.match(reader, /new pdfjs\.TextLayer/);
  assert.match(reader, /className="core-source-text-layer"/);
  assert.match(reader, /canvas ref=\{canvas\} aria-hidden="true"/);
  assert.match(styles, /\.core-source-text-layer \{[^}]*position: absolute[^}]*z-index: 1/s);
  assert.match(styles, /\.core-source-marks \{[^}]*z-index: 2/s);
});

test("today leads with one topic and shows evidence and next stops as secondary", async () => {
  const today = await source("components/TodayRoute.tsx");
  const page = await source("app/today/page.tsx");
  const surface = await source("components/RevisionSurface.tsx");
  const store = await source("lib/demo-store.ts");
  assert.match(today, /id="today-title"/);
  assert.match(today, /today-page-folio/);
  // Buttons in the product stay still: press motion is for the homepage and pricing only.
  assert.doesNotMatch(today, /whileTap/);
  assert.match(today, /startLabel \?\? "Start this topic"/);
  assert.match(today, /today-decision/);
  assert.match(today, /today-next/);
  assert.doesNotMatch(today, /today-plan-list|confidenceLabel|From your course/);
  assert.match(surface, /is-booklet-page/);
  assert.match(await source("app/workbench.css"), /--font-display|--font-source-serif/);
  assert.match(await source("app/workbench.css"), /radial-gradient|box-shadow/);
  assert.match(surface, /mode !== "today"/);
  assert.doesNotMatch(`${page}\n${surface}`, /RouteKnowledgeMap/);
  assert.doesNotMatch(surface, /<MasteryEvidence/);
  assert.match(store, /answer on \$\{concept\.name\} changed its mastery estimate/);
  assert.match(store, /higher learning value for the remaining time/);
});
