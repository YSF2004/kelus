import assert from "node:assert/strict";
import test from "node:test";
import { findQuote } from "../domain/source-quote.ts";

test("finds a quote despite punctuation, case and spacing", () => {
  const blocks = ["Elasticity", "Price elasticity of demand — the % change in quantity  demanded."];
  const ranges = findQuote(blocks, "price elasticity of demand: the change in quantity demanded");
  assert.deepEqual(ranges, [{ block: 1, start: 0, end: 63 }]);
});

test("folds accents and spans adjacent blocks", () => {
  const ranges = findQuote(["L'élasticité prix", "mesure la réaction."], "elasticite prix mesure la");
  assert.deepEqual(ranges, [{ block: 0, start: 2, end: 17 }, { block: 1, start: 0, end: 9 }]);
});

test("never marks part of an unrelated word", () => {
  assert.equal(findQuote(["Concatenate the supply curves."], "cat"), null);
  assert.equal(findQuote(["Supply shifts right."], "demand shifts"), null);
  assert.deepEqual(findQuote(["A cat sat."], "Cat"), [{ block: 0, start: 2, end: 5 }]);
});
