import test from "node:test";
import assert from "node:assert/strict";
import { clearStudyDraft, readStudyDraft, saveStudyDraft, studyDraftKey, validStudyDraft } from "../domain/study-draft.ts";

const run = {
  topic: "Elasticity",
  checks: [
    { id: "one", kind: "choice", prompt: "Which side bears more tax?", modelAnswer: "Less elastic", correctIndex: 0, choices: ["Less elastic", "More elastic"], sourceQuote: "The less elastic side bears more of the tax." },
    { id: "two", kind: "cloze", prompt: "Demand is ____ when buyers respond strongly.", modelAnswer: "elastic", sourceQuote: "Elastic demand responds strongly to price." },
  ],
  sentences: ["The less elastic side bears more of the tax.", "Elastic demand responds strongly to price."],
  explainPrompt: "Explain tax incidence.", explainAnswer: "The less elastic side bears more.", explainQuote: "The less elastic side bears more of the tax.",
};
const total = 2;
const now = 1_800_000_000_000;
const key = studyDraftKey(null, "session", "elasticity");
const initial = () => ({
  reading: -1, step: 0, picked: null, typed: "unfinished answer", tapped: null, answered: null,
  known: [], missed: [], unsure: 0, right: 0, explained: "", compared: false, elapsedMs: 1200, responseTracked: false,
});
function storage() {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: (key) => items.delete(key) };
}

test("an unfinished answer round-trips without becoming a graded learning event", () => {
  const store = storage();
  assert.equal(saveStudyDraft(store, key, run, total, initial(), now), true);
  assert.deepEqual(readStudyDraft(store, key, run, total, now), { kind: "restored", draft: initial() });
});

test("correct feedback survives reload and cannot be answered twice on restore", () => {
  const store = storage();
  const draft = { ...initial(), picked: 0, answered: { right: true, how: "exact", given: "Less elastic" }, known: [run.checks[0].sourceQuote], right: 1, responseTracked: true };
  saveStudyDraft(store, key, run, total, draft, now);
  assert.deepEqual(readStudyDraft(store, key, run, total, now).draft, draft);
});

test("incorrect and unsure feedback preserve missed source lines and do not add credit", () => {
  for (const answered of [{ right: false, given: "More elastic" }, { right: false, unsure: true }]) {
    const store = storage();
    const draft = { ...initial(), answered, missed: [run.checks[0].sourceQuote], unsure: answered.unsure ? 1 : 0 };
    saveStudyDraft(store, key, run, total, draft, now);
    assert.deepEqual(readStudyDraft(store, key, run, total, now).draft, draft);
  }
});

test("an explanation draft and its comparison survive reload", () => {
  const store = storage();
  const draft = { ...initial(), step: total, explained: "The side with fewer alternatives bears more.", compared: true, right: 1, known: [run.checks[0].sourceQuote], missed: [run.checks[1].sourceQuote] };
  saveStudyDraft(store, key, run, total, draft, now);
  assert.deepEqual(readStudyDraft(store, key, run, total, now).draft, draft);
});

test("account, session and topic boundaries cannot read each other's drafts", () => {
  const store = storage();
  saveStudyDraft(store, key, run, total, initial(), now);
  for (const other of [studyDraftKey("user", "session", "elasticity"), studyDraftKey(null, "other", "elasticity"), studyDraftKey(null, "session", "other")]) {
    assert.equal(readStudyDraft(store, other, run, total, now).kind, "empty");
  }
});

test("changed questions or answer contracts cannot inherit old scores", () => {
  const store = storage();
  saveStudyDraft(store, key, run, total, initial(), now);
  assert.equal(readStudyDraft(store, key, { ...run, explainAnswer: "Changed" }, total, now).kind, "changed");
});

test("corrupt, expired and out-of-range drafts are rejected safely", () => {
  const store = storage();
  store.setItem(key, "{");
  assert.equal(readStudyDraft(store, key, run, total, now).kind, "invalid");
  saveStudyDraft(store, key, run, total, initial(), now - 31 * 86400000);
  assert.equal(readStudyDraft(store, key, run, total, now).kind, "invalid");
  for (const bad of [{ step: 9 }, { right: -1 }, { picked: 10 }, { known: ["invented source"] }, { answered: { right: "yes" } }, { typed: {} }]) {
    assert.equal(validStudyDraft({ ...initial(), ...bad }, run, total), false);
  }
});

test("accepted alternate wording remains a valid saved result", () => {
  assert.equal(validStudyDraft({ ...initial(), answered: { right: true, how: "words" } }, run, total), true);
});

test("storage denial and quota failure are explicit rather than reported as saved", () => {
  const denied = { getItem() { throw Error("denied"); }, setItem() { throw Error("quota"); }, removeItem() { throw Error("denied"); } };
  assert.equal(readStudyDraft(denied, key, run, total, now).kind, "unavailable");
  assert.equal(saveStudyDraft(denied, key, run, total, initial(), now), false);
  assert.equal(clearStudyDraft(denied, key), false);
});

test("finishing clears only the current run draft", () => {
  const store = storage();
  const other = studyDraftKey(null, "other", "elasticity");
  saveStudyDraft(store, key, run, total, initial(), now);
  saveStudyDraft(store, other, run, total, initial(), now);
  assert.equal(clearStudyDraft(store, key), true);
  assert.equal(readStudyDraft(store, key, run, total, now).kind, "empty");
  assert.equal(readStudyDraft(store, other, run, total, now).kind, "restored");
});
