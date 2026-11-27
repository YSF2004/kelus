import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PostHog receives explicit Kelus events, page categories, retains pilot grouping, and honors internal opt-out", async () => {
  const originalWindow = globalThis.window;
  const originalGaKey = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const originalPostHogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc-test";
  globalThis.window = {
    location: { search: "" },
    localStorage: { getItem: () => null },
    addEventListener() {},
  };

  try {
    const { connectPostHog, setPilotCohort, trackEvent, trackPostHogPageViewed } = await import("../lib/analytics.ts");
    const captured = [];

    setPilotCohort("class-abc123");
    trackEvent({ name: "session_completed", concept_count: 3, planned_minutes: 8, course_type: "real" });
    connectPostHog((name, properties) => captured.push([name, properties]));

    assert.deepEqual(captured, [[
      "session_completed",
      { concept_count: 3, planned_minutes: 8, course_type: "real", pilot_cohort: "class-abc123" },
    ]]);

    trackPostHogPageViewed("study_plan");
    assert.deepEqual(captured[1], ["page_viewed", { page: "study_plan", pilot_cohort: "class-abc123" }]);

    globalThis.window.location.search = "?internal=1";
    trackEvent({ name: "invite_opened" });
    assert.equal(captured.length, 2, "internal devices do not send PostHog events");

    globalThis.window.location.search = "?internal=0";
    trackEvent({ name: "invite_opened" });
    assert.equal(captured.length, 3, "the explicit opt-in query enables events again");
  } finally {
    globalThis.window = originalWindow;
    if (originalGaKey === undefined) delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = originalGaKey;
    if (originalPostHogKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = originalPostHogKey;
  }
});

test("PostHog navigation uses only fixed product-area categories", async () => {
  const { kelusPageCategory } = await import("../lib/analytics.ts");
  assert.equal(kelusPageCategory("/"), "marketing_home");
  assert.equal(kelusPageCategory("/pdf-to-practice-questions"), "search_landing");
  assert.equal(kelusPageCategory("/today/"), "study_plan");
  assert.equal(kelusPageCategory("/session/own-words"), "study_session");
  assert.equal(kelusPageCategory("/someone's%20lecture"), "other");
});

test("PostHog stays opt-in, privacy-limited, and documented", async () => {
  const [provider, privacy, deploy, envExample] = await Promise.all([
    readFile(new URL("../components/PostHogAnalytics.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(provider, /autocapture:\s*false/);
  assert.match(provider, /capture_exceptions:\s*false/);
  assert.match(provider, /capture_pageview:\s*false/);
  assert.match(provider, /trackPostHogPageViewed\(kelusPageCategory\(path\)\)/);
  assert.match(provider, /disable_session_recording:\s*true/);
  assert.match(provider, /disable_capture_url_hashes:\s*true/);
  assert.match(provider, /before_send/);
  assert.match(provider, /analyticsOptedOut\(\)/);
  assert.match(privacy, /PostHog/);
  assert.match(privacy, /Neither analytics provider receives your notes, answers, name, or email/);
  assert.match(deploy, /NEXT_PUBLIC_POSTHOG_KEY/);
  assert.match(envExample, /NEXT_PUBLIC_POSTHOG_KEY=/);
});
