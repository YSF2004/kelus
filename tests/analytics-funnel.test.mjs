import assert from "node:assert/strict";
import test from "node:test";

test("a real-course milestone waits for GA bootstrap instead of being dropped", async () => {
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST";
  const listeners = new Map();
  const calls = [];
  const before = globalThis.window;
  globalThis.window = {
    addEventListener: (name, callback) => listeners.set(name, callback),
  };
  try {
    const { trackEvent } = await import("../lib/analytics.ts");
    trackEvent({ name: "material_upload_completed", role: "notes", course_type: "real" });
    assert.equal(calls.length, 0);
    globalThis.window.gtag = (...args) => calls.push(args);
    listeners.get("kelus-analytics-ready")();
    assert.deepEqual(calls, [["event", "material_upload_completed", { role: "notes", course_type: "real" }]]);
  } finally {
    globalThis.window = before;
  }
});

test("a landing page view and pilot cohort survive delayed GA bootstrap", async () => {
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST";
  const listeners = new Map();
  const calls = [];
  const before = globalThis.window;
  globalThis.window = {
    addEventListener: (name, callback) => listeners.set(name, callback),
  };
  try {
    const { setPilotCohort, trackEvent } = await import("../lib/analytics.ts");
    trackEvent({ name: "material_upload_completed", role: "notes", course_type: "real" });
    setPilotCohort("lycee-2b");
    trackEvent({ name: "page_view", page_path: "/?pilot=lycee-2b", page_location: "https://kelus.me/?pilot=lycee-2b", page_title: "Kelus", send_to: "G-TEST" });
    assert.equal(calls.length, 0);
    globalThis.window.gtag = (...args) => calls.push(args);
    listeners.get("kelus-analytics-ready")();
    assert.deepEqual(calls, [
      ["set", "user_properties", { pilot_cohort: "lycee-2b" }],
      ["event", "material_upload_completed", { role: "notes", course_type: "real" }],
      ["event", "page_view", { page_path: "/?pilot=lycee-2b", page_location: "https://kelus.me/?pilot=lycee-2b", page_title: "Kelus", send_to: "G-TEST" }],
    ]);
  } finally {
    globalThis.window = before;
  }
});
