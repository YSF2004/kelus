import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("critical study actions retain scoped touch sizes above the global 36px button rule", () => {
  assert.match(source("components/TodayQuiet.module.css"), /\.page \.next \.action \.go \{ min-height: 52px !important;/);
  assert.match(source("components/QuickRun.module.css"), /\.run \.card button\.primary\[type\] \{ min-height: 48px !important;/);
  assert.match(source("app/session/complete/complete.module.css"), /:global\(#main\) \.primary \{ min-height: 48px !important;/);
});

test("Today no longer hides its main action or reading content behind staggered opacity entrances", () => {
  const today = source("components/TodayRoute.tsx");
  const entry = today.split("\n").find((line) => line.includes("const settle ="));
  assert.ok(entry);
  assert.doesNotMatch(entry, /opacity/);
  assert.doesNotMatch(today, /const inCard =/);
  assert.match(today, /data-action="start-topic"/);
});

test("inline QuickResult completion sizes both actions, not just the separate completion route", () => {
  assert.match(
    source("components/QuickResult.module.css"),
    /\.card \.actions > button\.primary\[type\],\s*\.card \.actions > button\.secondary\[type\] \{ min-height: 52px !important;/,
  );
  const result = source("components/QuickResult.tsx");
  assert.match(result, /className=\{styles\.actions\}/);
  assert.match(result, /type="button" className=\{`k-btn k-btn--paper \$\{styles\.secondary\}`\}/);
  assert.match(result, /type="button" className=\{`k-btn \$\{styles\.primary\}`\}/);
});

test("the enclosing study panel does not fade reading content on first paint", () => {
  assert.match(
    source("components/RevisionSurface.tsx"),
    /className="studio-panel kelus-paper-body kelus-space-panel revision-surface-panel"\s+initial=\{false\}/,
  );
});
