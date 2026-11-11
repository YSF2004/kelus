import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PRODUCT_EVENT_NAMES } from "../lib/product-analytics.ts";

test("analytics covers the complete routing validation funnel", () => {
  assert.deepEqual(PRODUCT_EVENT_NAMES, [
    "setup_completed",
    "material_map_confirmed",
    "diagnosis_completed",
    "session_started",
    "answer_evaluated",
    "route_recalculated",
    "session_completed",
  ]);
});

test("GA4 records anonymous page views and the existing product funnel", async () => {
  const [layout, analytics, productAnalytics, deployment] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/GoogleAnalytics.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/product-analytics.ts", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /<GoogleAnalytics \/>/);
  assert.match(analytics, /NEXT_PUBLIC_GA_MEASUREMENT_ID/);
  assert.match(analytics, /strategy="lazyOnload"/);
  assert.match(analytics, /queueGoogleAnalyticsEvent\("page_view"/);
  assert.match(analytics, /send_page_view: false/);
  assert.match(productAnalytics, /queueGoogleAnalyticsEvent\(eventName, properties\)/);
  assert.match(deployment, /NEXT_PUBLIC_GA_MEASUREMENT_ID: \$\{\{ vars\.NEXT_PUBLIC_GA_MEASUREMENT_ID \}\}/);
});

test("learner actions emit evidence without answer or material contents", async () => {
  const provider = await readFile(new URL("../components/LearnerProvider.tsx", import.meta.url), "utf8");
  for (const eventName of PRODUCT_EVENT_NAMES) assert.match(provider, new RegExp(`trackProductEvent\\(\"${eventName}\"`));
  assert.doesNotMatch(provider, /response_text:/);
  assert.doesNotMatch(provider, /material_content:/);
  assert.match(provider, /days_since_previous_session/);
  assert.match(provider, /materially_reordered/);
});

test("Supabase analytics migration is private and indexed", async () => {
  const migration = await readFile(new URL("../database/005_product_events.sql", import.meta.url), "utf8");
  assert.match(migration, /enable row level security/);
  assert.match(migration, /auth\.uid\(\) = user_id/);
  assert.match(migration, /product_events_name_time_idx/);
});
